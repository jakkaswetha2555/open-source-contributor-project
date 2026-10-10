import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

const mongoose = (await import('mongoose')).default;
const { Session } = await import('../src/models/Session.js');
const { User } = await import('../src/models/User.js');
const { Project } = await import('../src/models/Project.js');
const { Snapshot } = await import('../src/models/Snapshot.js');
const { MaintainerGrant } = await import('../src/models/MaintainerGrant.js');
const { Chunk } = await import('../src/models/Chunk.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { createContributorChatRouter } = await import('../src/routes/contributor-chat.routes.js');
const {
  answerContributorQuestion,
  buildChunkVectorSearchPipeline,
} = await import('../src/services/rag/ragService.js');
const { chunksVectorIndex } = await import('../src/config/vectorIndexes.js');

const userId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439001');
const projectId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439002');
const snapshotId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439003');
const validToken = 'contributor-chat-test-session-token';
const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');
const version = 'v1.4.0';

let server;
let base;
const routeCalls = [];

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createContributorChatRouter({
    answerQuestion: async (args) => {
      routeCalls.push(args);
      return {
        found: true,
        answer: 'Run npm test.',
        citations: [{ filePath: 'CONTRIBUTING.md', snapshotVersion: args.snapshotVersion }],
        snapshotVersion: args.snapshotVersion,
      };
    },
  }));
  app.use(errorHandler);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

function mockAuthentication(role = 'contributor') {
  const session = mock.method(Session, 'findOne', async () => ({
    userId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const user = mock.method(User, 'findById', async () => ({
    _id: userId,
    role,
  }));
  return [session, user];
}

function mockProject(project) {
  return mock.method(Project, 'findById', async () => project);
}

function mockSnapshot(snapshot) {
  return mock.method(Snapshot, 'findOne', async () => snapshot);
}

function restoreMocks(mocks) {
  for (const item of mocks) item.mock.restore();
}

async function postChat({ token = validToken, project = projectId.toString() } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ projectId: project, question: 'How do I run the tests?' }),
  });
}

test('POST /api/contributor-chat rejects unauthenticated requests before project lookup', async () => {
  const projectLookup = mock.method(Project, 'findById', async () => null);

  const response = await postChat({ token: null });

  assert.equal(response.status, 401);
  assert.equal(projectLookup.mock.callCount(), 0);
  projectLookup.mock.restore();
});

test('private-project authorization runs before snapshot lookup or vector retrieval', async () => {
  const callsBefore = routeCalls.length;
  const mocks = [
    ...mockAuthentication('contributor'),
    mockProject({
      _id: projectId,
      visibility: 'private',
      verificationStatus: 'verified',
      currentSnapshotId: snapshotId,
    }),
    mock.method(MaintainerGrant, 'findOne', async () => null),
    mock.method(Snapshot, 'findOne', async () => {
      assert.fail('Snapshot must not be read before access is granted');
    }),
    mock.method(Chunk, 'aggregate', async () => {
      assert.fail('Chunks must not be retrieved before access is granted');
    }),
  ];

  const response = await postChat();
  const data = await response.json();

  assert.equal(response.status, 403);
  assert.equal(data.error.code, 'forbidden');
  assert.equal(routeCalls.length, callsBefore);
  restoreMocks(mocks);
});

test('verified public project chat uses the current snapshot and returns real citations', async () => {
  const project = {
    _id: projectId,
    visibility: 'public',
    verificationStatus: 'verified',
    currentSnapshotId: snapshotId,
  };
  const snapshot = { _id: snapshotId, version };
  const mocks = [
    ...mockAuthentication(),
    mockProject(project),
    mockSnapshot(snapshot),
  ];

  const response = await postChat();
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data, {
    found: true,
    answer: 'Run npm test.',
    citations: [{ filePath: 'CONTRIBUTING.md', snapshotVersion: version }],
    snapshotVersion: version,
  });
  assert.equal(routeCalls.at(-1).projectId, projectId);
  assert.equal(routeCalls.at(-1).snapshotId, snapshotId);
  assert.equal(routeCalls.at(-1).visibility, 'public');
  assert.equal(routeCalls.at(-1).snapshotVersion, version);
  restoreMocks(mocks);
});

test('unverified public projects remain hidden from ordinary contributors before snapshot lookup', async () => {
  const callsBefore = routeCalls.length;
  const mocks = [
    ...mockAuthentication('contributor'),
    mockProject({
      _id: projectId,
      visibility: 'public',
      verificationStatus: 'pending',
      currentSnapshotId: snapshotId,
    }),
    mock.method(MaintainerGrant, 'findOne', async () => null),
    mock.method(Snapshot, 'findOne', async () => {
      assert.fail('Snapshot must not be read for an unauthorized unverified project');
    }),
  ];

  const response = await postChat();

  assert.equal(response.status, 404);
  assert.equal(routeCalls.length, callsBefore);
  restoreMocks(mocks);
});

test('vector retrieval filters by project, snapshot, and permitted visibility', () => {
  const queryVector = new Array(768).fill(0.1);
  const pipeline = buildChunkVectorSearchPipeline({
    queryVector,
    projectId,
    snapshotId,
    visibility: 'private',
  });
  const vectorStage = pipeline[0].$vectorSearch;
  const configuredFields = chunksVectorIndex.definition.fields;

  assert.equal(vectorStage.index, chunksVectorIndex.name);
  assert.equal(vectorStage.path, 'embedding');
  assert.equal(vectorStage.filter.$and[0].projectId.$eq.toString(), projectId.toString());
  assert.equal(vectorStage.filter.$and[1].snapshotId.$eq.toString(), snapshotId.toString());
  assert.equal(vectorStage.filter.$and[2].visibility.$eq, 'private');
  assert.deepEqual(
    configuredFields.map((field) => field.path).sort(),
    ['embedding', 'projectId', 'snapshotId', 'visibility'],
  );
  assert.equal(pipeline[1].$project.embedding, undefined);
});

test('retrieved evidence produces citations from chunk paths and the trusted snapshot version', async () => {
  const evidence = [
    { filePath: 'CONTRIBUTING.md', text: 'Run npm test before submitting.', score: 0.9 },
    { filePath: 'CONTRIBUTING.md', text: 'Add tests for new routes.', score: 0.8 },
    { filePath: 'docs/setup.md', text: 'Install with npm install.', score: 0.7 },
  ];
  let retrievalArgs;

  const result = await answerContributorQuestion({
    question: 'How do I run tests?',
    projectId,
    snapshotId,
    visibility: 'public',
    snapshotVersion: version,
  }, {
    embedQuestion: async () => new Array(768).fill(0.1),
    retrieveChunks: async (args) => {
      retrievalArgs = args;
      return evidence;
    },
    generateAnswer: async ({ question, chunks }) => {
      assert.equal(question, 'How do I run tests?');
      assert.equal(chunks, evidence);
      return { found: true, answer: 'Run npm test.', evidenceNumbers: [1, 3, 99] };
    },
  });

  assert.equal(retrievalArgs.projectId, projectId);
  assert.equal(retrievalArgs.snapshotId, snapshotId);
  assert.equal(retrievalArgs.visibility, 'public');
  assert.deepEqual(result.citations, [
    { filePath: 'CONTRIBUTING.md', snapshotVersion: version },
    { filePath: 'docs/setup.md', snapshotVersion: version },
  ]);
});

test('no retrieved chunks return the required not-found answer without calling the chat model', async () => {
  let generationCalled = false;

  const result = await answerContributorQuestion({
    question: 'Where is the deployment guide?',
    projectId,
    snapshotId,
    visibility: 'public',
    snapshotVersion: version,
  }, {
    embedQuestion: async () => new Array(768).fill(0.1),
    retrieveChunks: async () => [],
    generateAnswer: async () => {
      generationCalled = true;
      return { found: true, answer: 'Unsupported guess.' };
    },
  });

  assert.equal(generationCalled, false);
  assert.deepEqual(result, {
    found: false,
    answer: 'Not found in snapshot.',
    citations: [],
    snapshotVersion: version,
  });
});

test('model-declared insufficient evidence also returns the fixed not-found response', async () => {
  const result = await answerContributorQuestion({
    question: 'Where is the deployment guide?',
    projectId,
    snapshotId,
    visibility: 'public',
    snapshotVersion: version,
  }, {
    embedQuestion: async () => new Array(768).fill(0.1),
    retrieveChunks: async () => [{ filePath: 'README.md', text: 'Project readme.' }],
    generateAnswer: async () => ({ found: false, answer: 'I do not see it.' }),
  });

  assert.equal(result.found, false);
  assert.equal(result.answer, 'Not found in snapshot.');
  assert.deepEqual(result.citations, []);
});

test('invalid embedding dimensions stop before vector retrieval', async () => {
  let retrievalCalled = false;

  await assert.rejects(
    answerContributorQuestion({
      question: 'How do I run tests?',
      projectId,
      snapshotId,
      visibility: 'public',
      snapshotVersion: version,
    }, {
      embedQuestion: async () => [0.1, 0.2],
      retrieveChunks: async () => {
        retrievalCalled = true;
        return [];
      },
      generateAnswer: async () => ({ found: false, answer: 'No evidence.' }),
    }),
    /768 dimensions/,
  );
  assert.equal(retrievalCalled, false);
});
