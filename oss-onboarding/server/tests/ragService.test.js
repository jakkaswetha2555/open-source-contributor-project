import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { EMBEDDING_DIMENSIONS } from '../src/constants.js';
import { Chunk } from '../src/models/Chunk.js';
import { Project } from '../src/models/Project.js';
import { Snapshot } from '../src/models/Snapshot.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';
const {
  RESULT_LIMIT,
  NUM_CANDIDATES,
  NO_EVIDENCE_ANSWER,
  generateQueryEmbedding,
  searchChunks,
  generateGroundedAnswer,
  answerContributorQuestion,
} = await import('../src/services/rag/ragService.js');

const dummy768Vector = new Array(EMBEDDING_DIMENSIONS).fill(0.05);

test('ragService: generateQueryEmbedding validates input and returns 768-dimensional vector', async () => {
  // Empty question rejects with 400
  await assert.rejects(
    async () => {
      await generateQueryEmbedding('');
    },
    (err) => err.status === 400 && err.code === 'invalid_query',
  );

  await assert.rejects(
    async () => {
      await generateQueryEmbedding('   ');
    },
    (err) => err.status === 400 && err.code === 'invalid_query',
  );

  // Successful embedding call
  const embedMock = mock.method(OllamaEmbeddings.prototype, 'embedQuery', async () => dummy768Vector);
  const vector = await generateQueryEmbedding('How do I run tests?');
  embedMock.mock.restore();

  assert.equal(vector.length, EMBEDDING_DIMENSIONS);
});

test('ragService: generateQueryEmbedding rejects invalid embedding dimensions from Ollama', async () => {
  const embedMock = mock.method(OllamaEmbeddings.prototype, 'embedQuery', async () => [0.1, 0.2]);

  await assert.rejects(
    async () => {
      await generateQueryEmbedding('How to configure?');
    },
    (err) => err.status === 502 && err.code === 'invalid_embedding_dimensions',
  );
  embedMock.mock.restore();
});

test('ragService: searchChunks constructs Atlas Vector Search pipeline with metadata filters', async () => {
  const projectId = new mongoose.Types.ObjectId();
  const snapshotId = new mongoose.Types.ObjectId();

  let capturedPipeline;
  const aggregateMock = mock.method(Chunk, 'aggregate', async (pipeline) => {
    capturedPipeline = pipeline;
    return [
      {
        _id: new mongoose.Types.ObjectId(),
        filePath: 'README.md',
        chunkIndex: 0,
        text: 'Run npm test to execute the test suite.',
        visibility: 'public',
        score: 0.92,
      },
    ];
  });

  const results = await searchChunks({
    projectId,
    snapshotId,
    visibility: 'public',
    queryVector: dummy768Vector,
  });

  aggregateMock.mock.restore();

  assert.equal(results.length, 1);
  assert.equal(results[0].filePath, 'README.md');

  // Verify $vectorSearch stage
  assert.ok(capturedPipeline);
  const vectorSearchStage = capturedPipeline[0].$vectorSearch;
  assert.equal(vectorSearchStage.index, 'chunks_vector_index');
  assert.equal(vectorSearchStage.path, 'embedding');
  assert.equal(vectorSearchStage.numCandidates, NUM_CANDIDATES);
  assert.equal(vectorSearchStage.limit, RESULT_LIMIT);
  assert.ok(vectorSearchStage.filter.$and[0].projectId.$eq.equals(projectId));
  assert.ok(vectorSearchStage.filter.$and[1].snapshotId.$eq.equals(snapshotId));
  assert.equal(vectorSearchStage.filter.$and[2].visibility.$eq, 'public');
});

test('ragService: generateGroundedAnswer returns safe not-found when chunks are empty without invoking LLM', async () => {
  let llmCalled = false;
  const chatMock = mock.method(ChatOllama.prototype, 'invoke', async () => {
    llmCalled = true;
    return { content: '{"found":true,"answer":"Hallucination","evidenceNumbers":[1]}' };
  });

  const result = await generateGroundedAnswer({
    question: 'How to install?',
    chunks: [],
    snapshotVersion: 'v1.0.0',
  });

  chatMock.mock.restore();

  assert.equal(llmCalled, false);
  assert.equal(result.found, false);
  assert.equal(result.answer, NO_EVIDENCE_ANSWER);
  assert.deepEqual(result.citations, []);
  assert.equal(result.snapshotVersion, 'v1.0.0');
});

test('ragService: generateGroundedAnswer builds server-side citations and validates answer', async () => {
  const chunks = [
    {
      _id: new mongoose.Types.ObjectId(),
      filePath: 'docs/setup.md',
      text: 'Run npm install and set MONGODB_URI to configure the backend.',
    },
    {
      _id: new mongoose.Types.ObjectId(),
      filePath: 'docs/testing.md',
      text: 'Execute npm test to run the full test suite.',
    },
  ];

  const chatMock = mock.method(ChatOllama.prototype, 'invoke', async () => ({
    content: JSON.stringify({
      found: true,
      answer: 'Run npm install and configure MONGODB_URI in your environment.',
      evidenceNumbers: [1],
    }),
  }));

  const result = await generateGroundedAnswer({
    question: 'How do I set up the database and dependencies?',
    chunks,
    snapshotVersion: 'v1.2.0',
  });

  chatMock.mock.restore();

  assert.equal(result.found, true);
  assert.equal(result.answer, 'Run npm install and configure MONGODB_URI in your environment.');
  assert.equal(result.snapshotVersion, 'v1.2.0');
  assert.equal(result.citations.length, 1);
  assert.equal(result.citations[0].filePath, 'docs/setup.md');
  assert.equal(result.citations[0].snapshotVersion, 'v1.2.0');
});

test('ragService: generateGroundedAnswer returns not-found when model cannot find evidence or hallucinated indices', async () => {
  const chunks = [
    {
      _id: new mongoose.Types.ObjectId(),
      filePath: 'docs/faq.md',
      text: 'General FAQs about community meetings.',
    },
  ];

  // Model indicates found=false
  const chatMock = mock.method(ChatOllama.prototype, 'invoke', async () => ({
    content: JSON.stringify({
      found: false,
      answer: 'Not found in snapshot.',
      evidenceNumbers: [],
    }),
  }));

  const result = await generateGroundedAnswer({
    question: 'Where is the Dockerfile?',
    chunks,
    snapshotVersion: 'v1.0.0',
  });

  chatMock.mock.restore();

  assert.equal(result.found, false);
  assert.equal(result.answer, NO_EVIDENCE_ANSWER);
  assert.deepEqual(result.citations, []);
});

test('ragService: answerContributorQuestion enforces authorization and snapshot isolation', async () => {
  const projectId = new mongoose.Types.ObjectId();
  const snapshotId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const mockProject = new Project({
    _id: projectId,
    name: 'Private Project',
    slug: 'priv-proj',
    visibility: 'private',
    currentSnapshotId: snapshotId,
  });

  // 1. Unauthenticated or non-maintainer blocked on private project
  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);

  await assert.rejects(
    async () => {
      await answerContributorQuestion({
        projectId: projectId.toString(),
        question: 'Any secret keys?',
        user: { _id: userId, role: 'contributor' },
      });
    },
    (err) => err.status === 403 && err.code === 'forbidden',
  );

  grantMock.mock.restore();
  findProjectMock.mock.restore();
});
