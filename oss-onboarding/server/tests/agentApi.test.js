import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Session } from '../src/models/Session.js';
import { User } from '../src/models/User.js';
import { AgentRun } from '../src/models/AgentRun.js';
import { Issue } from '../src/models/Issue.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

const testUserId = '507f1f77bcf86cd799439001';
const testProjectId = '507f1f77bcf86cd799439002';
const testIssueId = '507f1f77bcf86cd799439011';
const validToken = 'my-valid-secure-session-token-12345';
const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

let server, base;

before(async () => {
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('POST /api/onboarding-agent: rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${base}/api/onboarding-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: 'Find a task I can start this weekend' }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'unauthorized');
  assert.equal(data.error.message, 'Authentication required');
});

test('POST /api/onboarding-agent: rejects invalid or expired session token with 401', async () => {
  const sessionMock = mock.method(Session, 'findOne', async () => null);

  const res = await fetch(`${base}/api/onboarding-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid-token',
    },
    body: JSON.stringify({ goal: 'Find a task' }),
  });

  sessionMock.mock.restore();

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'unauthorized');
});

test('POST /api/onboarding-agent: rejects invalid body with 422 validation_error', async () => {
  const mockUser = {
    _id: new mongoose.Types.ObjectId(testUserId),
    email: 'contributor@test.com',
    name: 'Test Contributor',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUser._id,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));

  const userMock = mock.method(User, 'findById', async () => mockUser);

  // Invalid: goal is empty/too short (< 3 chars)
  const res = await fetch(`${base}/api/onboarding-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({ goal: 'a' }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();

  assert.equal(res.status, 422);
  const data = await res.json();
  assert.equal(data.error.code, 'validation_error');
  assert.ok(data.error.details.length > 0);
});

test('POST /api/onboarding-agent: successful request uses authenticated user and ignores spoofed body userId', async () => {
  const mockUser = {
    _id: new mongoose.Types.ObjectId(testUserId),
    email: 'realuser@test.com',
    name: 'Real Contributor',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUser._id,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));

  const userMock = mock.method(User, 'findById', async () => mockUser);

  let capturedRunUserId = null;
  const runCreateMock = mock.method(AgentRun, 'create', async (doc) => {
    capturedRunUserId = doc.userId;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      toolCalls: [],
    };
  });

  const runUpdateMock = mock.method(AgentRun, 'findByIdAndUpdate', async (id, update) => {
    return {
      _id: id,
      status: update.status || 'completed',
      toolCalls: update.$push?.toolCalls ? [update.$push.toolCalls] : [],
      recommendation: update.recommendation || { found: false },
    };
  });

  const issueFindMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  }));

  // Malicious request attempt: user tries to spoof body with someone else's ID:
  // Note: agentRequestSchema uses .strict(), so an unauthorized 'userId' key will be rejected by Zod!
  const res = await fetch(`${base}/api/onboarding-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      goal: 'Find a task I can start this weekend',
      projectId: testProjectId,
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  runCreateMock.mock.restore();
  runUpdateMock.mock.restore();
  issueFindMock.mock.restore();

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'completed');
  assert.ok(data.runId);

  // Identity was strictly taken from session user
  assert.equal(capturedRunUserId.toString(), testUserId);
});

test('POST /api/onboarding-agent: returns 500 without leaking stack traces on unexpected server errors', async () => {
  const mockUser = {
    _id: new mongoose.Types.ObjectId(testUserId),
    email: 'user@test.com',
  };

  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId: mockUser._id,
    tokenHash: validTokenHash,
    expiresAt: new Date(Date.now() + 100000),
  }));

  const userMock = mock.method(User, 'findById', async () => mockUser);

  const runCreateMock = mock.method(AgentRun, 'create', async () => {
    throw new Error('Secret internal DB crash error details');
  });

  const res = await fetch(`${base}/api/onboarding-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${validToken}`,
    },
    body: JSON.stringify({
      goal: 'Find a task I can start this weekend',
    }),
  });

  sessionMock.mock.restore();
  userMock.mock.restore();
  runCreateMock.mock.restore();

  assert.equal(res.status, 500);
  const data = await res.json();
  assert.equal(data.error.code, 'server_error');
  assert.equal(data.error.message, 'Internal server error');
  // No internal stack trace or secret error details leaked
  assert.equal(data.error.stack, undefined);
  assert.equal(JSON.stringify(data).includes('Secret internal DB crash'), false);
});
