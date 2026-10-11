import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { OllamaEmbeddings } from '@langchain/ollama';
import { Project } from '../src/models/Project.js';
import { Issue } from '../src/models/Issue.js';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';
import { Snapshot } from '../src/models/Snapshot.js';
import { Document } from '../src/models/Document.js';
import { Chunk } from '../src/models/Chunk.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

let server, base;

const mockPublicProjectId = new mongoose.Types.ObjectId();
const mockPrivateProjectId = new mongoose.Types.ObjectId();
const mockMaintainerId = new mongoose.Types.ObjectId();
const mockContributorId = new mongoose.Types.ObjectId();
const validToken = 'valid-session-token-projects-test';
const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

before(async () => {
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('GET /api/projects: returns only verified public projects', async () => {
  const mockProjects = [
    {
      _id: mockPublicProjectId,
      name: 'Project Alpha',
      slug: 'project-alpha',
      description: 'First public project',
      repoUrl: 'https://github.com/example/alpha',
      visibility: 'public',
      verificationStatus: 'verified',
    },
  ];

  const findMock = mock.method(Project, 'find', () => ({
    select: () => ({
      sort: () => ({
        lean: async () => mockProjects,
      }),
    }),
  }));

  const res = await fetch(`${base}/api/projects`);
  findMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.count, 1);
  assert.equal(data.projects.length, 1);
  assert.equal(data.projects[0].name, 'Project Alpha');
  assert.equal(data.projects[0].visibility, 'public');
});

test('GET /api/projects/:id: returns 404 if project does not exist', async () => {
  const findMock = mock.method(Project, 'findById', async () => null);
  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}`);
  findMock.mock.restore();

  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, 'not_found');
});

test('GET /api/projects/:id: blocks unauthenticated access to private project', async () => {
  const mockPrivateProject = {
    _id: mockPrivateProjectId,
    name: 'Private Vault',
    slug: 'private-vault',
    visibility: 'private',
    verificationStatus: 'verified',
  };

  const findMock = mock.method(Project, 'findById', async () => mockPrivateProject);
  const res = await fetch(`${base}/api/projects/${mockPrivateProjectId}`);
  findMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
  assert.equal(data.error.message, 'Project is private');
});

test('GET /api/projects/:id/issues: returns open issues for public project', async () => {
  const mockProject = {
    _id: mockPublicProjectId,
    name: 'Public Project',
    slug: 'public-project',
    visibility: 'public',
    verificationStatus: 'verified',
  };

  const mockIssues = [
    {
      _id: new mongoose.Types.ObjectId(),
      projectId: mockPublicProjectId,
      title: 'Fix documentation typo',
      summary: 'Typo in README',
      requiredSkills: ['markdown'],
      prerequisites: ['git'],
      status: 'open',
      staleSetupFlag: false,
    },
  ];

  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const findIssuesMock = mock.method(Issue, 'find', () => ({
    select: () => ({
      populate: () => ({
        sort: () => ({
          lean: async () => mockIssues,
        }),
      }),
    }),
  }));

  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}/issues`);
  findProjectMock.mock.restore();
  findIssuesMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.project.slug, 'public-project');
  assert.equal(data.count, 1);
  assert.equal(data.issues[0].title, 'Fix documentation typo');
  assert.equal(data.issues[0].status, 'open');
});

test('GET /api/projects/:id/issues: blocks unauthenticated access to private project issues', async () => {
  const mockPrivateProject = {
    _id: mockPrivateProjectId,
    name: 'Secret System',
    slug: 'secret-system',
    visibility: 'private',
    verificationStatus: 'verified',
  };

  const findProjectMock = mock.method(Project, 'findById', async () => mockPrivateProject);
  const res = await fetch(`${base}/api/projects/${mockPrivateProjectId}/issues`);
  findProjectMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
});

test('POST /api/projects/:id/imports: rejects non-maintainer with 403', async () => {
  const mockProject = {
    _id: mockPublicProjectId,
    name: 'Public Project',
    createdBy: mockMaintainerId,
  };

  const mockUser = {
    _id: mockContributorId,
    role: 'contributor',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockContributorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);

  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}/imports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      version: 'v1.0.0',
      documents: [{ filePath: 'README.md', title: 'README', content: 'Hello World' }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  findProjectMock.mock.restore();
  grantMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
});

test('POST /api/projects/:id/imports: allows maintainer to import snapshot documents and issues', async () => {
  const mockProject = new Project({
    _id: mockPublicProjectId,
    name: 'Public Project',
    slug: 'public-proj',
    createdBy: mockMaintainerId,
  });

  const mockUser = {
    _id: mockMaintainerId,
    role: 'maintainer',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockMaintainerId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => ({ status: 'active' }));
  const snapshotMock = mock.method(Snapshot, 'create', async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc }));
  let persistedDocuments;
  const docMock = mock.method(Document, 'insertMany', async (docs) => {
    persistedDocuments = docs;
    return docs;
  });
  let embeddedTexts;
  let persistedChunks;
  const embeddingMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async function (texts) {
    assert.equal(this.model, process.env.EMBED_MODEL || 'nomic-embed-text');
    assert.equal(this.baseUrl, process.env.OLLAMA_URL || 'http://localhost:11434');
    embeddedTexts = texts;
    return texts.map(() => new Array(768).fill(0.1));
  });
  const chunkMock = mock.method(Chunk, 'insertMany', async (chunks) => {
    persistedChunks = chunks;
    return chunks;
  });
  const issueMock = mock.method(Issue, 'insertMany', async (issues) => issues);
  const saveMock = mock.method(mockProject, 'save', async () => mockProject);

  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}/imports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      version: 'v1.0.0',
      source: 'https://github.com/example/public',
      documents: [{ filePath: 'README.md', title: 'README', content: 'Doc content' }],
      issues: [{ title: 'First Issue', summary: 'Sample summary', requiredSkills: ['Node.js'], prerequisites: [] }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  findProjectMock.mock.restore();
  grantMock.mock.restore();
  snapshotMock.mock.restore();
  docMock.mock.restore();
  embeddingMock.mock.restore();
  chunkMock.mock.restore();
  issueMock.mock.restore();
  saveMock.mock.restore();

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.version, 'v1.0.0');
  assert.equal(data.documentsCount, 1);
  assert.equal(data.issuesCount, 1);
  assert.equal(embeddingMock.mock.callCount(), 1);
  assert.equal(chunkMock.mock.callCount(), 1);
  assert.equal(embeddedTexts.length, 1);
  assert.equal(embeddedTexts[0], 'Doc content');
  assert.equal(persistedChunks.length, 1);
  assert.equal(persistedChunks[0].projectId.toString(), mockProject._id.toString());
  assert.equal(persistedChunks[0].snapshotId.toString(), data.snapshotId);
  assert.equal(persistedChunks[0].documentId.toString(), persistedDocuments[0]._id.toString());
  assert.equal(persistedChunks[0].filePath, 'README.md');
  assert.equal(persistedChunks[0].text, 'Doc content');
  assert.equal(persistedChunks[0].visibility, 'public');
  assert.equal(persistedChunks[0].embedding.length, 768);
});

test('POST /api/projects/:id/imports: embedding failure does not write or activate an incomplete snapshot', async () => {
  const previousSnapshotId = new mongoose.Types.ObjectId();
  const mockProject = new Project({
    _id: mockPublicProjectId,
    name: 'Public Project',
    slug: 'public-proj',
    createdBy: mockMaintainerId,
    currentSnapshotId: previousSnapshotId,
  });
  const mockUser = { _id: mockMaintainerId, role: 'maintainer' };
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockMaintainerId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => ({ status: 'active' }));
  const snapshotMock = mock.method(Snapshot, 'create', async () => {
    throw new Error('Snapshot must not be written when embedding fails');
  });
  const docMock = mock.method(Document, 'insertMany', async () => {
    throw new Error('Documents must not be written when embedding fails');
  });
  const chunkMock = mock.method(Chunk, 'insertMany', async () => {
    throw new Error('Chunks must not be written when embedding fails');
  });
  const embeddingMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async () => {
    throw new Error('Ollama unavailable');
  });
  const saveMock = mock.method(mockProject, 'save', async () => mockProject);

  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}/imports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      version: 'v2.0.0',
      documents: [{ filePath: 'README.md', title: 'README', content: 'Doc content' }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  findProjectMock.mock.restore();
  grantMock.mock.restore();
  snapshotMock.mock.restore();
  docMock.mock.restore();
  chunkMock.mock.restore();
  embeddingMock.mock.restore();
  saveMock.mock.restore();

  assert.equal(res.status, 500);
  assert.equal(embeddingMock.mock.callCount(), 1);
  assert.equal(snapshotMock.mock.callCount(), 0);
  assert.equal(docMock.mock.callCount(), 0);
  assert.equal(chunkMock.mock.callCount(), 0);
  assert.equal(saveMock.mock.callCount(), 0);
  assert.equal(mockProject.currentSnapshotId.toString(), previousSnapshotId.toString());
});

test('POST /api/projects/:id/imports: chunk storage failure does not activate the new snapshot', async () => {
  const previousSnapshotId = new mongoose.Types.ObjectId();
  const mockProject = new Project({
    _id: mockPublicProjectId,
    name: 'Public Project',
    slug: 'public-proj',
    createdBy: mockMaintainerId,
    currentSnapshotId: previousSnapshotId,
  });
  const mockUser = { _id: mockMaintainerId, role: 'maintainer' };
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockMaintainerId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const findProjectMock = mock.method(Project, 'findById', async () => mockProject);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => ({ status: 'active' }));
  const snapshotMock = mock.method(Snapshot, 'create', async (doc) => doc);
  const docMock = mock.method(Document, 'insertMany', async (docs) => docs);
  const chunkMock = mock.method(Chunk, 'insertMany', async () => {
    throw new Error('Chunk storage unavailable');
  });
  const chunkDeleteMock = mock.method(Chunk, 'deleteMany', async () => ({ deletedCount: 0 }));
  const documentDeleteMock = mock.method(Document, 'deleteMany', async () => ({ deletedCount: 1 }));
  const issueDeleteMock = mock.method(Issue, 'deleteMany', async () => ({ deletedCount: 0 }));
  const snapshotDeleteMock = mock.method(Snapshot, 'deleteOne', async () => ({ deletedCount: 1 }));
  const embeddingMock = mock.method(OllamaEmbeddings.prototype, 'embedDocuments', async (texts) => (
    texts.map(() => new Array(768).fill(0.1))
  ));
  const saveMock = mock.method(mockProject, 'save', async () => mockProject);

  const res = await fetch(`${base}/api/projects/${mockPublicProjectId}/imports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      version: 'v2.1.0',
      documents: [{ filePath: 'README.md', title: 'README', content: 'Doc content' }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  findProjectMock.mock.restore();
  grantMock.mock.restore();
  snapshotMock.mock.restore();
  docMock.mock.restore();
  chunkMock.mock.restore();
  chunkDeleteMock.mock.restore();
  documentDeleteMock.mock.restore();
  issueDeleteMock.mock.restore();
  snapshotDeleteMock.mock.restore();
  embeddingMock.mock.restore();
  saveMock.mock.restore();

  assert.equal(res.status, 500);
  assert.equal(chunkMock.mock.callCount(), 1);
  assert.equal(chunkDeleteMock.mock.callCount(), 1);
  assert.equal(documentDeleteMock.mock.callCount(), 1);
  assert.equal(issueDeleteMock.mock.callCount(), 1);
  assert.equal(snapshotDeleteMock.mock.callCount(), 1);
  assert.equal(saveMock.mock.callCount(), 0);
  assert.equal(mockProject.currentSnapshotId.toString(), previousSnapshotId.toString());
});
