import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Issue } from '../src/models/Issue.js';
import { Project } from '../src/models/Project.js';
import { Interest } from '../src/models/Interest.js';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

let server, base;

const mockProjectId = new mongoose.Types.ObjectId();
const mockIssueId = new mongoose.Types.ObjectId();
const mockContributorId = new mongoose.Types.ObjectId();
const mockMaintainerId = new mongoose.Types.ObjectId();

const validToken = 'valid-token-for-issues-tests';
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

test('GET /api/issues/:id: returns 404 on invalid id or not found', async () => {
  const res = await fetch(`${base}/api/issues/invalid-id`);
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, 'not_found');
});

test('GET /api/issues/:id: returns issue details for public project', async () => {
  const mockIssue = {
    _id: mockIssueId,
    title: 'Improve error handling',
    summary: 'Add clear error codes',
    status: 'open',
    projectId: {
      _id: mockProjectId,
      name: 'Test Project',
      slug: 'test-project',
      visibility: 'public',
      verificationStatus: 'verified',
    },
  };

  const findMock = mock.method(Issue, 'findById', () => ({
    select: () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockIssue,
        }),
      }),
    }),
  }));
  const countMock = mock.method(Interest, 'countDocuments', async () => 3);

  const res = await fetch(`${base}/api/issues/${mockIssueId}`);
  findMock.mock.restore();
  countMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.issue.title, 'Improve error handling');
  assert.equal(data.interestCount, 3);
});

test('POST /api/issues/:id/interest: rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${base}/api/issues/${mockIssueId}/interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'unauthorized');
});

test('POST /api/issues/:id/interest: rejects unknown body fields with 422', async () => {
  const mockUser = { _id: mockContributorId, role: 'contributor' };
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockContributorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);

  const res = await fetch(`${base}/api/issues/${mockIssueId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({ unexpectedKey: 'malicious' }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.error.code, 'validation_error');
});

test('POST /api/issues/:id/interest: saves contributor interest successfully with 201', async () => {
  const mockUser = { _id: mockContributorId, role: 'contributor' };
  const mockIssue = { _id: mockIssueId, projectId: mockProjectId, status: 'open' };
  const mockProject = { _id: mockProjectId, visibility: 'public' };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockContributorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const issueMock = mock.method(Issue, 'findById', async () => mockIssue);
  const projectMock = mock.method(Project, 'findById', async () => mockProject);
  const interestFindMock = mock.method(Interest, 'findOne', async () => null);
  const interestCreateMock = mock.method(Interest, 'create', async (doc) => ({
    _id: new mongoose.Types.ObjectId(),
    ...doc,
    createdAt: new Date(),
  }));

  const res = await fetch(`${base}/api/issues/${mockIssueId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({}),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  issueMock.mock.restore();
  projectMock.mock.restore();
  interestFindMock.mock.restore();
  interestCreateMock.mock.restore();

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.message, 'Interest recorded successfully');
  assert.equal(data.interest.userId.toString(), mockContributorId.toString());
});

test('PATCH /api/issues/:id: rejects non-maintainer with 403', async () => {
  const mockUser = { _id: mockContributorId, role: 'contributor' };
  const mockIssue = { _id: mockIssueId, projectId: mockProjectId, status: 'open' };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockContributorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const issueMock = mock.method(Issue, 'findById', async () => mockIssue);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);
  const projectMock = mock.method(Project, 'findById', async () => ({ createdBy: mockMaintainerId }));

  const res = await fetch(`${base}/api/issues/${mockIssueId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({ status: 'closed' }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  issueMock.mock.restore();
  grantMock.mock.restore();
  projectMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
  assert.equal(data.error.message, 'Only maintainers of this project can update issues');
});

test('PATCH /api/issues/:id: allows maintainer to update issue and flag stale setup', async () => {
  const mockUser = { _id: mockMaintainerId, role: 'maintainer' };
  const mockIssue = new Issue({
    _id: mockIssueId,
    projectId: mockProjectId,
    title: 'Setup Guide Issue',
    summary: 'Original summary',
    status: 'open',
    staleSetupFlag: false,
  });

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockMaintainerId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const issueMock = mock.method(Issue, 'findById', async () => mockIssue);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => ({ status: 'active' }));
  const projectMock = mock.method(Project, 'findById', async () => ({ createdBy: mockMaintainerId }));
  const saveMock = mock.method(mockIssue, 'save', async () => mockIssue);

  const res = await fetch(`${base}/api/issues/${mockIssueId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      staleSetupFlag: true,
      summary: 'Updated summary reflecting new repo structure',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  issueMock.mock.restore();
  grantMock.mock.restore();
  projectMock.mock.restore();
  saveMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.message, 'Issue updated successfully');
  assert.equal(data.issue.staleSetupFlag, true);
  assert.equal(data.issue.summary, 'Updated summary reflecting new repo structure');
});
