import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { ContributionPlan } from '../src/models/ContributionPlan.js';
import { Issue } from '../src/models/Issue.js';
import { Project } from '../src/models/Project.js';
import { Review } from '../src/models/Review.js';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

let server, base;

const mockProjectId = new mongoose.Types.ObjectId();
const mockIssueId = new mongoose.Types.ObjectId();
const mockPlanId = new mongoose.Types.ObjectId();
const mockAuthorId = new mongoose.Types.ObjectId();
const mockOtherUserId = new mongoose.Types.ObjectId();
const mockMaintainerId = new mongoose.Types.ObjectId();

const validToken = 'valid-token-for-plans-test';
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

test('POST /api/contribution-plans: rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${base}/api/contribution-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issueId: mockIssueId.toString(),
      approach: 'I will write tests and update the documentation properly.',
      evidence: [{ filePath: 'README.md', snapshotVersion: 'v1.0' }],
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'unauthorized');
});

test('POST /api/contribution-plans: rejects plan without evidence with 422', async () => {
  const mockUser = { _id: mockAuthorId, role: 'contributor' };
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockAuthorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);

  const res = await fetch(`${base}/api/contribution-plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      issueId: mockIssueId.toString(),
      approach: 'I will write tests and update the documentation properly.',
      evidence: [], // Evidence is mandatory!
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.error.code, 'validation_error');
});

test('POST /api/contribution-plans: rejects body containing authorId (spoof attempt)', async () => {
  const mockUser = { _id: mockAuthorId, role: 'contributor' };
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockAuthorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);

  const res = await fetch(`${base}/api/contribution-plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      issueId: mockIssueId.toString(),
      authorId: mockOtherUserId.toString(), // Strict Zod schema must reject!
      approach: 'I will write tests and update the documentation properly.',
      evidence: [{ filePath: 'README.md', snapshotVersion: 'v1.0' }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.error.code, 'validation_error');
});

test('POST /api/contribution-plans: creates plan owned by authenticated contributor with 201', async () => {
  const mockUser = { _id: mockAuthorId, role: 'contributor' };
  const mockIssue = { _id: mockIssueId, projectId: mockProjectId, status: 'open' };
  const mockProject = { _id: mockProjectId, visibility: 'public' };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockAuthorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const issueMock = mock.method(Issue, 'findById', async () => mockIssue);
  const projectMock = mock.method(Project, 'findById', async () => mockProject);

  let createdPlanDoc = null;
  const planCreateMock = mock.method(ContributionPlan, 'create', async (doc) => {
    createdPlanDoc = doc;
    return {
      _id: mockPlanId,
      ...doc,
      createdAt: new Date(),
    };
  });

  const res = await fetch(`${base}/api/contribution-plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      issueId: mockIssueId.toString(),
      approach: 'I will implement the unit test suite and verify every endpoint.',
      steps: ['Inspect routes', 'Write tests', 'Run test runner'],
      evidence: [{ filePath: 'README.md', snapshotVersion: 'v1.0' }],
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  issueMock.mock.restore();
  projectMock.mock.restore();
  planCreateMock.mock.restore();

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.message, 'Contribution plan created successfully');
  assert.equal(createdPlanDoc.authorId.toString(), mockAuthorId.toString());
  assert.equal(createdPlanDoc.status, 'submitted');
});

test('GET /api/contribution-plans/:id: forbids another contributor from viewing plan', async () => {
  const mockUser = { _id: mockOtherUserId, role: 'contributor' };
  const mockPlan = {
    _id: mockPlanId,
    authorId: mockAuthorId, // Owned by mockAuthorId, not mockOtherUserId!
    projectId: mockProjectId,
    approach: 'Some private approach',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockOtherUserId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const planFindMock = mock.method(ContributionPlan, 'findById', () => ({
    populate: () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockPlan,
        }),
      }),
    }),
  }));
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);
  const projectMock = mock.method(Project, 'findById', async () => ({ createdBy: mockMaintainerId }));

  const res = await fetch(`${base}/api/contribution-plans/${mockPlanId}`, {
    headers: {
      Authorization: `Bearer ${validToken}`,
    },
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  planFindMock.mock.restore();
  grantMock.mock.restore();
  projectMock.mock.restore();

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'forbidden');
  assert.equal(data.error.message, 'You do not have permission to view this contribution plan');
});

test('GET /api/contribution-plans/:id: author can view their own plan', async () => {
  const mockUser = { _id: mockAuthorId, role: 'contributor' };
  const mockPlan = {
    _id: mockPlanId,
    authorId: { _id: mockAuthorId, name: 'Alice', email: 'alice@test.com' },
    projectId: { _id: mockProjectId, name: 'Sample' },
    approach: 'Alice approach details',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockAuthorId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const planFindMock = mock.method(ContributionPlan, 'findById', () => ({
    populate: () => ({
      populate: () => ({
        populate: () => ({
          lean: async () => mockPlan,
        }),
      }),
    }),
  }));

  const res = await fetch(`${base}/api/contribution-plans/${mockPlanId}`, {
    headers: {
      Authorization: `Bearer ${validToken}`,
    },
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  planFindMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.plan.approach, 'Alice approach details');
});

test('POST /api/contribution-plans/:id/review: maintainer can approve plan and assign issue', async () => {
  const mockUser = { _id: mockMaintainerId, role: 'maintainer' };
  const mockPlan = new ContributionPlan({
    _id: mockPlanId,
    issueId: mockIssueId,
    projectId: mockProjectId,
    authorId: mockAuthorId,
    approach: 'Solid approach',
    evidence: [{ filePath: 'README.md', snapshotVersion: 'v1' }],
    status: 'submitted',
  });

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockMaintainerId,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));
  const userMock = mock.method(User, 'findById', async () => mockUser);
  const planFindMock = mock.method(ContributionPlan, 'findById', async () => mockPlan);
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => ({ status: 'active' }));
  const projectMock = mock.method(Project, 'findById', async () => ({ createdBy: mockMaintainerId }));
  const reviewCreateMock = mock.method(Review, 'create', async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc }));
  const planSaveMock = mock.method(mockPlan, 'save', async () => mockPlan);
  const issueUpdateMock = mock.method(Issue, 'findByIdAndUpdate', async () => ({}));

  const res = await fetch(`${base}/api/contribution-plans/${mockPlanId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      decision: 'approved',
      feedback: 'Excellent breakdown. Approved!',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  planFindMock.mock.restore();
  grantMock.mock.restore();
  projectMock.mock.restore();
  reviewCreateMock.mock.restore();
  planSaveMock.mock.restore();
  issueUpdateMock.mock.restore();

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.planStatus, 'approved');
  assert.equal(mockPlan.status, 'approved');
});
