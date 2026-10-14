import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { Project } from '../src/models/Project.js';
import { Snapshot } from '../src/models/Snapshot.js';
import { Chunk } from '../src/models/Chunk.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';
import { OllamaEmbeddings, ChatOllama } from '@langchain/ollama';
import { EMBEDDING_DIMENSIONS } from '../src/constants.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

let server, base;

const mockUserId = new mongoose.Types.ObjectId();
const mockPublicProjectId = new mongoose.Types.ObjectId();
const mockPrivateProjectId = new mongoose.Types.ObjectId();
const mockSnapshotId = new mongoose.Types.ObjectId();
const validToken = 'valid-token-contributor-chat-test';
const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0.01);

before(async () => {
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('POST /api/contributor-chat: rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'How do I run the project?',
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'unauthorized');
});

test('POST /api/contributor-chat: rejects invalid body with 422', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => ({
    _id: mockUserId,
    role: 'contributor',
  }));

  // Missing question
  const res1 = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
    }),
  });

  // Question too short (< 3 chars)
  const res2 = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'hi',
    }),
  });

  // Unknown extra field rejected by .strict()
  const res3 = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'Valid question here?',
      extraField: 'disallowed',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();

  assert.equal(res1.status, 422);
  assert.equal(res2.status, 422);
  assert.equal(res3.status, 422);
});

test('POST /api/contributor-chat: blocks non-maintainer access to private project with 403', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => ({
    _id: mockUserId,
    role: 'contributor',
  }));
  const projectMock = mock.method(Project, 'findById', async () => ({
    _id: mockPrivateProjectId,
    name: 'Private Project',
    visibility: 'private',
    currentSnapshotId: mockSnapshotId,
  }));
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);

  const res = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPrivateProjectId.toString(),
      question: 'What is inside private docs?',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  projectMock.mock.restore();
  grantMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
});

test('POST /api/contributor-chat: returns 404 when project has no active snapshot', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => ({
    _id: mockUserId,
    role: 'contributor',
  }));
  const projectMock = mock.method(Project, 'findById', async () => ({
    _id: mockPublicProjectId,
    name: 'Public Project',
    visibility: 'public',
    verificationStatus: 'verified',
    currentSnapshotId: null,
  }));

  const res = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'How do I install dependencies?',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  projectMock.mock.restore();

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, 'not_found');
  assert.match(data.error.message, /active snapshot/i);
});

test('POST /api/contributor-chat: returns grounded answer with server citations for verified public project', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => ({
    _id: mockUserId,
    role: 'contributor',
  }));
  const projectMock = mock.method(Project, 'findById', async () => ({
    _id: mockPublicProjectId,
    name: 'Public Project',
    visibility: 'public',
    verificationStatus: 'verified',
    currentSnapshotId: mockSnapshotId,
  }));
  const snapshotMock = mock.method(Snapshot, 'findById', async () => ({
    _id: mockSnapshotId,
    projectId: mockPublicProjectId,
    version: 'v1.1.0',
  }));
  const embedMock = mock.method(OllamaEmbeddings.prototype, 'embedQuery', async () => dummyVector);
  const aggregateMock = mock.method(Chunk, 'aggregate', async () => [
    {
      _id: new mongoose.Types.ObjectId(),
      filePath: 'docs/CONTRIBUTING.md',
      chunkIndex: 0,
      text: 'To contribute, clone the repo and run npm install.',
      visibility: 'public',
    },
  ]);
  const chatMock = mock.method(ChatOllama.prototype, 'invoke', async () => ({
    content: JSON.stringify({
      found: true,
      answer: 'Clone the repository and run npm install to contribute.',
      evidenceNumbers: [1],
    }),
  }));

  const res = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'How can I get started contributing?',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  projectMock.mock.restore();
  snapshotMock.mock.restore();
  embedMock.mock.restore();
  aggregateMock.mock.restore();
  chatMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.found, true);
  assert.equal(data.answer, 'Clone the repository and run npm install to contribute.');
  assert.equal(data.snapshotVersion, 'v1.1.0');
  assert.equal(data.citations.length, 1);
  assert.equal(data.citations[0].filePath, 'docs/CONTRIBUTING.md');
  assert.equal(data.citations[0].snapshotVersion, 'v1.1.0');
});

test('POST /api/contributor-chat: returns safe "Not found in snapshot." when no chunks are retrieved', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => ({
    _id: mockUserId,
    role: 'contributor',
  }));
  const projectMock = mock.method(Project, 'findById', async () => ({
    _id: mockPublicProjectId,
    name: 'Public Project',
    visibility: 'public',
    verificationStatus: 'verified',
    currentSnapshotId: mockSnapshotId,
  }));
  const snapshotMock = mock.method(Snapshot, 'findById', async () => ({
    _id: mockSnapshotId,
    projectId: mockPublicProjectId,
    version: 'v1.1.0',
  }));
  const embedMock = mock.method(OllamaEmbeddings.prototype, 'embedQuery', async () => dummyVector);
  const aggregateMock = mock.method(Chunk, 'aggregate', async () => []);

  const res = await fetch(`${base}/api/contributor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      projectId: mockPublicProjectId.toString(),
      question: 'What is the secret deployment key?',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  projectMock.mock.restore();
  snapshotMock.mock.restore();
  embedMock.mock.restore();
  aggregateMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.found, false);
  assert.equal(data.answer, 'Not found in snapshot.');
  assert.deepEqual(data.citations, []);
  assert.equal(data.snapshotVersion, 'v1.1.0');
});
