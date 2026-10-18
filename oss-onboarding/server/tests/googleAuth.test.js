import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';
process.env.GOOGLE_CLIENT_ID ||= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL ||= 'http://localhost:5000/api/auth/google/callback';

const { createGoogleAuthRouter } = await import('../src/routes/google-auth.routes.js');
const { User } = await import('../src/models/User.js');
const { Session } = await import('../src/models/Session.js');
const { env } = await import('../src/config/env.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

function buildApp(overrides = {}) {
  const app = express();
  app.use(cookieParser());
  app.use('/api', createGoogleAuthRouter(overrides));
  app.use(errorHandler);
  return app;
}

async function startApp(overrides) {
  const app = buildApp(overrides);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('GET /api/auth/google redirects to Google with a state param and sets a state cookie', async () => {
  const { server, base } = await startApp();
  const res = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  server.close();

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.equal(location.origin, 'https://accounts.google.com');
  assert.equal(location.searchParams.get('client_id'), 'test-client-id');
  assert.equal(location.searchParams.get('response_type'), 'code');
  assert.ok(location.searchParams.get('state'));
  assert.match(res.headers.get('set-cookie') || '', /oauth_state=/);
});

test('GET /api/auth/google is 503 when Google credentials are not configured', async () => {
  const original = { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET };
  env.GOOGLE_CLIENT_ID = undefined;
  env.GOOGLE_CLIENT_SECRET = undefined;
  const { server, base } = await startApp();
  const res = await fetch(`${base}/api/auth/google`, { redirect: 'manual' });
  server.close();
  env.GOOGLE_CLIENT_ID = original.id;
  env.GOOGLE_CLIENT_SECRET = original.secret;

  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'oauth_not_configured');
});

test('callback: missing/invalid state is rejected without calling Google', async () => {
  let called = false;
  const { server, base } = await startApp({
    exchangeCode: async () => { called = true; return {}; },
  });
  const res = await fetch(`${base}/api/auth/google/callback?code=abc&state=mismatch`, {
    redirect: 'manual',
    headers: { Cookie: 'oauth_state=something-else' },
  });
  server.close();

  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /error=google_oauth_invalid_state/);
  assert.equal(called, false);
});

test('callback: Google denying consent redirects with an error, no token exchange attempted', async () => {
  let called = false;
  const { server, base } = await startApp({
    exchangeCode: async () => { called = true; return {}; },
  });
  const res = await fetch(`${base}/api/auth/google/callback?error=access_denied`, { redirect: 'manual' });
  server.close();

  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /error=google_oauth_denied/);
  assert.equal(called, false);
});

test('callback: new Google identity creates a verified user and a session, redirects with a csrf token', async () => {
  const state = 'abc123state';
  const createdUser = { _id: new mongoose.Types.ObjectId(), email: 'new.contributor@gmail.com', role: 'contributor' };

  const findOneMock = mock.method(User, 'findOne', async () => null);
  const createUserMock = mock.method(User, 'create', async (doc) => {
    assert.equal(doc.email, 'new.contributor@gmail.com');
    assert.equal(doc.googleId, 'google-sub-42');
    assert.equal(doc.emailVerified, true);
    assert.equal(doc.role, 'contributor');
    return createdUser;
  });
  let sessionDoc;
  const createSessionMock = mock.method(Session, 'create', async (doc) => { sessionDoc = doc; return doc; });

  const { server, base } = await startApp({
    exchangeCode: async ({ code }) => {
      assert.equal(code, 'the-auth-code');
      return { access_token: 'fake-access-token', id_token: 'fake-id-token' };
    },
    fetchProfile: async ({ accessToken }) => {
      assert.equal(accessToken, 'fake-access-token');
      return { googleId: 'google-sub-42', email: 'new.contributor@gmail.com', emailVerified: true, name: 'New Contributor' };
    },
  });

  const res = await fetch(`${base}/api/auth/google/callback?code=the-auth-code&state=${state}`, {
    redirect: 'manual',
    headers: { Cookie: `oauth_state=${state}` },
  });
  server.close();
  findOneMock.mock.restore();
  createUserMock.mock.restore();
  createSessionMock.mock.restore();

  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  assert.ok(location.searchParams.get('csrf'), 'redirect carries a one-time csrf token');
  assert.match(res.headers.get('set-cookie') || '', /sid=/);
  assert.equal(String(sessionDoc.userId), String(createdUser._id));
  assert.equal(sessionDoc.csrfToken, location.searchParams.get('csrf'));
});

test('callback: existing email/password account with a matching email gets Google linked, not duplicated', async () => {
  const state = 'link-state';
  const existing = {
    _id: new mongoose.Types.ObjectId(),
    email: 'already.has.password@example.com',
    emailVerified: false,
    save: mock.fn(async function save() { return this; }),
  };

  let call = 0;
  const findOneMock = mock.method(User, 'findOne', async () => (call++ === 0 ? null : existing));
  const createUserMock = mock.method(User, 'create', async () => { throw new Error('should not create a new user when one already exists by email'); });
  const createSessionMock = mock.method(Session, 'create', async (doc) => doc);

  const { server, base } = await startApp({
    exchangeCode: async () => ({ access_token: 'tok', id_token: 'idtok' }),
    fetchProfile: async () => ({ googleId: 'google-sub-99', email: 'already.has.password@example.com', emailVerified: true, name: 'Existing' }),
  });

  const res = await fetch(`${base}/api/auth/google/callback?code=c&state=${state}`, {
    redirect: 'manual',
    headers: { Cookie: `oauth_state=${state}` },
  });
  server.close();
  findOneMock.mock.restore();
  createUserMock.mock.restore();
  createSessionMock.mock.restore();

  assert.equal(res.status, 302);
  assert.equal(existing.googleId, 'google-sub-99');
  assert.equal(existing.emailVerified, true);
  assert.equal(existing.save.mock.callCount(), 1);
});

test('callback: Google token exchange failure is a clean redirect, not a 500 or an uncaught throw', async () => {
  const state = 'fail-state';
  const { server, base } = await startApp({
    exchangeCode: async () => { const e = new Error('boom'); e.status = 502; e.code = 'google_token_exchange_failed'; throw e; },
  });
  const res = await fetch(`${base}/api/auth/google/callback?code=c&state=${state}`, {
    redirect: 'manual',
    headers: { Cookie: `oauth_state=${state}` },
  });
  server.close();
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error.code, 'google_token_exchange_failed');
});
