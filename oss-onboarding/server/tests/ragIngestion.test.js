import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

import { OllamaEmbeddings } from '@langchain/ollama';
import { EMBEDDING_DIMENSIONS } from '../src/constants.js';
import { Chunk } from '../src/models/Chunk.js';
const {
  CHUNK_MAX_SIZE,
  CHUNK_OVERLAP,
  splitTextIntoChunks,
  chunkDocument,
  chunkDocuments,
  validateEmbedding,
  generateEmbeddings,
  ingestSnapshotDocuments,
} = await import('../src/services/rag/ingestionService.js');

test('ragIngestion: splitTextIntoChunks handles empty or whitespace text', () => {
  assert.deepEqual(splitTextIntoChunks(''), []);
  assert.deepEqual(splitTextIntoChunks('   \n\n  '), []);
  assert.deepEqual(splitTextIntoChunks(null), []);
  assert.deepEqual(splitTextIntoChunks(undefined), []);
});

test('ragIngestion: splitTextIntoChunks leaves text <= maxSize in single chunk', () => {
  const shortText = 'This is a short markdown document explaining repository setup.';
  const chunks = splitTextIntoChunks(shortText, 1200, 150);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], shortText);
});

test('ragIngestion: splitTextIntoChunks splits long text respecting boundaries and bounds', () => {
  const paragraph1 = 'A'.repeat(800);
  const paragraph2 = 'B'.repeat(800);
  const combined = `${paragraph1}\n\n${paragraph2}`;

  const chunks = splitTextIntoChunks(combined, 1000, 100);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 1000, `Chunk length ${chunk.length} exceeds max 1000`);
    assert.ok(chunk.length > 0);
  }
});

test('ragIngestion: chunkDocument and chunkDocuments number chunks per document and preserve filePath', () => {
  const doc1 = {
    _id: new mongoose.Types.ObjectId(),
    filePath: 'README.md',
    content: 'First document section one.\n\nFirst document section two.',
  };
  const doc2 = {
    _id: new mongoose.Types.ObjectId(),
    filePath: 'docs/CONTRIBUTING.md',
    content: 'Contributing guidelines for new joiners.',
  };

  const chunks = chunkDocuments([doc1, doc2], { maxSize: 30, overlap: 5 });
  assert.ok(chunks.length >= 2);

  const doc1Chunks = chunks.filter((c) => c.filePath === 'README.md');
  const doc2Chunks = chunks.filter((c) => c.filePath === 'docs/CONTRIBUTING.md');

  assert.ok(doc1Chunks.length >= 1);
  assert.ok(doc2Chunks.length >= 1);

  // Per-document chunk index starts at 0
  assert.equal(doc1Chunks[0].chunkIndex, 0);
  assert.equal(doc2Chunks[0].chunkIndex, 0);
});

test('ragIngestion: validateEmbedding enforces 768-dimensional finite numbers', () => {
  const validVector = new Array(EMBEDDING_DIMENSIONS).fill(0.123);
  assert.equal(validateEmbedding(validVector), true);

  // Reject wrong dimensions
  assert.throws(() => validateEmbedding(new Array(512).fill(0.1)), /768 dimensions/);
  assert.throws(() => validateEmbedding(new Array(769).fill(0.1)), /768 dimensions/);

  // Reject non-array
  assert.throws(() => validateEmbedding('not-an-array'), /must be an array/);

  // Reject NaN / non-finite
  const nanVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
  nanVector[10] = NaN;
  assert.throws(() => validateEmbedding(nanVector), /not a finite number/);

  const infVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1);
  infVector[5] = Infinity;
  assert.throws(() => validateEmbedding(infVector), /not a finite number/);
});

test('ragIngestion: generateEmbeddings throws clear error on Ollama failure or dimension mismatch', async () => {
  // Empty array returns empty without calling Ollama
  const emptyRes = await generateEmbeddings([]);
  assert.deepEqual(emptyRes, []);

  // Ollama connection failure
  const failMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:11434');
  });

  await assert.rejects(
    async () => {
      await generateEmbeddings(['test text']);
    },
    (err) => err.code === 'ollama_error' && err.status === 502,
  );
  failMock.mock.restore();

  // Ollama returning wrong dimensions
  const wrongDimMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async () => [
    new Array(512).fill(0.1),
  ]);

  await assert.rejects(
    async () => {
      await generateEmbeddings(['test text']);
    },
    (err) => err.code === 'invalid_embedding_dimensions' && err.status === 502,
  );
  wrongDimMock.mock.restore();
});

test('ragIngestion: ingestSnapshotDocuments creates Chunk records with metadata and embeddings', async () => {
  const projectId = new mongoose.Types.ObjectId();
  const snapshotId = new mongoose.Types.ObjectId();
  const docId = new mongoose.Types.ObjectId();

  const documents = [
    {
      _id: docId,
      filePath: 'docs/architecture.md',
      content: 'System architecture overview.',
    },
  ];

  const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0.02);
  let deleteManyCalled = false;
  const deleteMock = mock.method(Chunk, 'deleteMany', async (query) => {
    deleteManyCalled = true;
    return { acknowledged: true, deletedCount: 0 };
  });
  const embedMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async () => [dummyVector]);
  const insertMock = mock.method(Chunk, 'insertMany', async (chunks) => chunks);

  const saved = await ingestSnapshotDocuments({
    projectId,
    snapshotId,
    documents,
    visibility: 'public',
  });

  embedMock.mock.restore();
  insertMock.mock.restore();
  deleteMock.mock.restore();

  assert.equal(deleteManyCalled, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].filePath, 'docs/architecture.md');
  assert.equal(saved[0].chunkIndex, 0);
  assert.equal(saved[0].visibility, 'public');
  assert.equal(saved[0].embedding.length, EMBEDDING_DIMENSIONS);
  assert.ok(saved[0].projectId.equals(projectId));
  assert.ok(saved[0].snapshotId.equals(snapshotId));
});
