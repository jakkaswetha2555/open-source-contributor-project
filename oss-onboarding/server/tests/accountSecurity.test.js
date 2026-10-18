import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { hashToken } from '../src/services/account/tokens.js';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

let server, base;
before(async () => {
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('login rate limit: 5 wrong passwords for one account are allowed, the 6th gets 429', async () => {
  const hash = await bcrypt.hash('correct-horse-battery', 4);
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(), passwordHash: hash, emailVerified: true }) }));
  const statuses = [];
  for (let i = 0; i < 6; i += 1) {
    const res = await post('/api/auth/login', { email: 'ratelimit@example.com', password: 'wrong-password' });
    statuses.push(res.status);
  }
  findMock.mock.restore();
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
});

test('login: a Google-only account (no passwordHash) gets a clean 401, not a 500', async () => {
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(), googleId: 'g-1', passwordHash: undefined, emailVerified: true }) }));
  const res = await post('/api/auth/login', { email: 'google-only@example.com', password: 'whatever-they-typed' });
  findMock.mock.restore();
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'invalid_credentials');
});

test('login rate limit is per account: another email is not blocked by the first one', async () => {
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => null }));
  const res = await post('/api/auth/login', { email: 'someone-else@example.com', password: 'wrong-password' });
  findMock.mock.restore();
  assert.equal(res.status, 401);
});

test('429 uses the consistent JSON error shape', async () => {
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => null }));
  let last;
  for (let i = 0; i < 6; i += 1) last = await post('/api/auth/login', { email: 'shape@example.com', password: 'wrong-password' });
  findMock.mock.restore();
  assert.equal(last.status, 429);
  assert.equal((await last.json()).error.code, 'too_many_login_attempts');
});

test('session cookie set at login (sid) authenticates GET /api/me', async () => {
  const token = 'cookie-session-token-test';
  const userId = new mongoose.Types.ObjectId();
  const sessionMock = mock.method(Session, 'findOne', async () => ({
    userId, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), csrfToken: 'c', expiresAt: new Date(Date.now() + 1e6),
  }));
  const userMock = mock.method(User, 'findById', async () => ({ _id: userId, name: 'A', email: 'a@b.com', role: 'contributor', emailVerified: true, skills: [], interests: [] }));
  const res = await fetch(`${base}/api/me`, { headers: { Cookie: `sid=${token}` } });
  sessionMock.mock.restore();
  userMock.mock.restore();
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user.email, 'a@b.com');
});

test('GET /api/me without a session is 401', async () => {
  assert.equal((await fetch(`${base}/api/me`)).status, 401);
});

test('verify-email: valid token verifies the account and clears the token', async () => {
  const token = 'a'.repeat(64);
  let saved = false;
  const user = { emailVerified: false, emailVerifyTokenHash: hashToken(token), emailVerifyExpires: new Date(Date.now() + 1e6), save: async () => { saved = true; } };
  let query;
  const findMock = mock.method(User, 'findOne', (q) => { query = q; return { select: async () => user }; });
  const res = await fetch(`${base}/api/auth/verify-email?token=${token}`);
  findMock.mock.restore();
  assert.equal(res.status, 200);
  assert.equal(query.emailVerifyTokenHash, hashToken(token));
  assert.ok(query.emailVerifyExpires.$gt instanceof Date);
  assert.equal(user.emailVerified, true);
  assert.equal(user.emailVerifyTokenHash, undefined);
  assert.ok(saved);
});

test('verify-email: unknown or expired token is rejected', async () => {
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => null }));
  const res = await fetch(`${base}/api/auth/verify-email?token=${'b'.repeat(64)}`);
  findMock.mock.restore();
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'invalid_token');
});

test('forgot-password: same answer whether or not the email exists (no account enumeration)', async () => {
  const known = { email: 'known@example.com', save: async () => {} };
  let call = 0;
  const findMock = mock.method(User, 'findOne', async () => (call++ === 0 ? known : null));
  const a = await post('/api/auth/forgot-password', { email: 'known@example.com' });
  const b = await post('/api/auth/forgot-password', { email: 'unknown@example.com' });
  findMock.mock.restore();
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(await a.json(), await b.json());
  assert.ok(known.passwordResetTokenHash, 'a hashed reset token is stored for the real account');
  assert.ok(known.passwordResetExpires > new Date());
});

test('reset-password: sets a new password hash, burns the token and signs out all sessions', async () => {
  const token = 'c'.repeat(64);
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, passwordHash: 'old', passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + 1e6), save: async () => {} };
  const findMock = mock.method(User, 'findOne', () => ({ select: async () => user }));
  let deleted;
  const delMock = mock.method(Session, 'deleteMany', async (q) => { deleted = q; return {}; });
  const res = await post('/api/auth/reset-password', { token, password: 'a-new-long-password' });
  findMock.mock.restore();
  delMock.mock.restore();
  assert.equal(res.status, 200);
  assert.ok(await bcrypt.compare('a-new-long-password', user.passwordHash));
  assert.equal(user.passwordResetTokenHash, undefined);
  assert.equal(String(deleted.userId), String(userId));
});

test('reset-password: weak password is rejected before touching the database', async () => {
  const res = await post('/api/auth/reset-password', { token: 'd'.repeat(64), password: 'short' });
  assert.equal(res.status, 422);
});
