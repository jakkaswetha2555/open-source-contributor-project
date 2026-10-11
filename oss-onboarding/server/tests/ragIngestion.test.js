import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

const { EMBEDDING_DIMENSIONS } = await import('../src/constants.js');
const { Chunk } = await import('../src/models/Chunk.js');
const {
  DOCUMENT_CHUNK_OVERLAP,
  DOCUMENT_CHUNK_SIZE,
  prepareSnapshotChunks,
  splitDocumentContent,
} = await import('../src/services/rag/ingestionService.js');

test('splitDocumentContent creates bounded, overlapping chunks and returns every section', () => {
  const content = '0123456789'.repeat(50);
  const chunks = splitDocumentContent(content, { chunkSize: 100, chunkOverlap: 20 });

  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  assert.equal(chunks[0].slice(-20), chunks[1].slice(0, 20));

  const sectionA = 'A'.repeat(250);
  const sectionB = 'B'.repeat(250);
  const paragraphChunks = splitDocumentContent(`${sectionA}\n\n${sectionB}`, {
    chunkSize: 100,
    chunkOverlap: 20,
  });
  assert.ok(paragraphChunks.some((chunk) => chunk.includes('A')));
  assert.ok(paragraphChunks.some((chunk) => chunk.includes('B')));
  assert.deepEqual(splitDocumentContent(' \n\t '), []);
  assert.equal(DOCUMENT_CHUNK_SIZE, 1200);
  assert.equal(DOCUMENT_CHUNK_OVERLAP, 150);
});

test('prepareSnapshotChunks embeds and preserves the metadata required by Chunk and vector search', async () => {
  const projectId = new mongoose.Types.ObjectId();
  const snapshotId = new mongoose.Types.ObjectId();
  const documentId = new mongoose.Types.ObjectId();
  let embeddedTexts;

  const chunks = await prepareSnapshotChunks({
    projectId,
    snapshotId,
    visibility: 'private',
    documents: [{
      _id: documentId,
      filePath: 'docs/setup.md',
      content: 'Setup instructions.',
    }],
  }, {
    embedDocuments: async (texts) => {
      embeddedTexts = texts;
      return texts.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0.25));
    },
  });

  assert.equal(chunks.length, 1);
  assert.deepEqual(embeddedTexts, ['Setup instructions.']);
  assert.equal(chunks[0].projectId.toString(), projectId.toString());
  assert.equal(chunks[0].snapshotId.toString(), snapshotId.toString());
  assert.equal(chunks[0].documentId.toString(), documentId.toString());
  assert.equal(chunks[0].filePath, 'docs/setup.md');
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[0].text, 'Setup instructions.');
  assert.equal(chunks[0].visibility, 'private');
  assert.equal(chunks[0].embedding.length, EMBEDDING_DIMENSIONS);
  assert.equal(await new Chunk(chunks[0]).validate(), undefined);
});

test('prepareSnapshotChunks numbers chunks per file and rejects invalid embedding output', async () => {
  const shared = {
    projectId: new mongoose.Types.ObjectId(),
    snapshotId: new mongoose.Types.ObjectId(),
    visibility: 'public',
    documents: [{
      _id: new mongoose.Types.ObjectId(),
      filePath: 'long.txt',
      content: 'word '.repeat(90),
    }, {
      _id: new mongoose.Types.ObjectId(),
      filePath: 'short.txt',
      content: 'Short file.',
    }],
  };
  const chunks = await prepareSnapshotChunks(shared, {
    chunkSize: 80,
    chunkOverlap: 10,
    embedDocuments: async (texts) => texts.map(() => new Array(EMBEDDING_DIMENSIONS).fill(0.5)),
  });

  assert.ok(chunks.length > 2);
  const shortFileChunks = chunks.filter((chunk) => chunk.filePath === 'short.txt');
  assert.equal(shortFileChunks.length, 1);
  assert.equal(shortFileChunks[0].chunkIndex, 0);
  assert.equal(chunks.filter((chunk) => chunk.filePath === 'long.txt')[0].chunkIndex, 0);

  await assert.rejects(
    prepareSnapshotChunks(shared, {
      chunkSize: 80,
      chunkOverlap: 10,
      embedDocuments: async (texts) => texts.map(() => [0.1, 0.2]),
    }),
    /768 finite numbers/,
  );
  await assert.rejects(
    prepareSnapshotChunks(shared, {
      chunkSize: 80,
      chunkOverlap: 10,
      embedDocuments: async () => [],
    }),
    /one embedding for every document chunk/,
  );
});

test('prepareSnapshotChunks fails explicitly for unsearchable content and invalid visibility', async () => {
  const document = {
    _id: new mongoose.Types.ObjectId(),
    filePath: 'empty.md',
    content: '   ',
  };
  let embedCalled = false;
  const embedDocuments = async () => {
    embedCalled = true;
    return [];
  };

  await assert.rejects(
    prepareSnapshotChunks({
      projectId: new mongoose.Types.ObjectId(),
      snapshotId: new mongoose.Types.ObjectId(),
      visibility: 'public',
      documents: [document],
    }, { embedDocuments }),
    /has no searchable text/,
  );
  assert.equal(embedCalled, false);

  await assert.rejects(
    prepareSnapshotChunks({
      projectId: new mongoose.Types.ObjectId(),
      snapshotId: new mongoose.Types.ObjectId(),
      visibility: 'secret',
      documents: [document],
    }, { embedDocuments }),
    /valid project visibility/,
  );
});
