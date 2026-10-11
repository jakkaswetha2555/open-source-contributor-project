import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Project } from '../src/models/Project.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { ContributionPlan } from '../src/models/ContributionPlan.js';

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

const token = 'moderation-test-token';
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

function signedInAs(role) {
  const id = new mongoose.Types.ObjectId();
  const s = mock.method(Session, 'findOne', async () => ({ userId: id, tokenHash, csrfToken: 'x', expiresAt: new Date(Date.now() + 1e6) }));
  const u = mock.method(User, 'findById', async () => ({ _id: id, role, name: 'T' }));
  return { id, restore: () => { s.mock.restore(); u.mock.restore(); } };
}
const patch = (id, body) =>
  fetch(`${base}/api/projects/${id}/verification`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });

test('verification: a contributor cannot verify projects (403)', async () => {
  const me = signedInAs('contributor');
  const res = await patch(new mongoose.Types.ObjectId(), { status: 'verified' });
  me.restore();
  assert.equal(res.status, 403);
});

test('verification: a maintainer cannot verify their own project (403)', async () => {
  const me = signedInAs('maintainer');
  const res = await patch(new mongoose.Types.ObjectId(), { status: 'verified' });
  me.restore();
  assert.equal(res.status, 403);
});

test('verification: no session is 401', async () => {
  const res = await fetch(`${base}/api/projects/${new mongoose.Types.ObjectId()}/verification`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'verified' }) });
  assert.equal(res.status, 401);
});

test('verification: moderator verifies a project, pending grants become active and users become maintainers', async () => {
  const me = signedInAs('moderator');
  const projectId = new mongoose.Types.ObjectId();
  const project = new Project({ _id: projectId, name: 'P', slug: 'p', verificationStatus: 'pending' });
  const projMock = mock.method(Project, 'findById', async () => project);
  const saveMock = mock.method(project, 'save', async () => project);
  const grantUser = new mongoose.Types.ObjectId();
  const grants = [{ _id: new mongoose.Types.ObjectId(), userId: grantUser }];
  const findGrants = mock.method(MaintainerGrant, 'find', async () => grants);
  let grantUpdate; let userUpdate;
  const updGrants = mock.method(MaintainerGrant, 'updateMany', async (q, u) => { grantUpdate = u; return {}; });
  const updUsers = mock.method(User, 'updateMany', async (q, u) => { userUpdate = { q, u }; return { modifiedCount: 1 }; });

  const res = await patch(projectId, { status: 'verified' });
  [projMock, saveMock, findGrants, updGrants, updUsers].forEach((m) => m.mock.restore());
  me.restore();

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.project.verificationStatus, 'verified');
  assert.equal(body.maintainersActivated, 1);
  assert.equal(grantUpdate.status, 'active');
  assert.equal(userUpdate.u.role, 'maintainer');
  assert.deepEqual(userUpdate.q.role, 'contributor');
});

test('verification: rejecting revokes pending grants and promotes nobody', async () => {
  const me = signedInAs('moderator');
  const projectId = new mongoose.Types.ObjectId();
  const project = new Project({ _id: projectId, name: 'P', slug: 'p2' });
  const projMock = mock.method(Project, 'findById', async () => project);
  const saveMock = mock.method(project, 'save', async () => project);
  const findGrants = mock.method(MaintainerGrant, 'find', async () => [{ _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId() }]);
  let grantUpdate;
  const updGrants = mock.method(MaintainerGrant, 'updateMany', async (q, u) => { grantUpdate = u; return {}; });
  const updUsers = mock.method(User, 'updateMany', async () => { throw new Error('must not promote on reject'); });
  const res = await patch(projectId, { status: 'rejected' });
  [projMock, saveMock, findGrants, updGrants, updUsers].forEach((m) => m.mock.restore());
  me.restore();
  assert.equal(res.status, 200);
  assert.equal(grantUpdate.status, 'revoked');
});

test('verification: invalid status is a 422', async () => {
  const me = signedInAs('moderator');
  const res = await patch(new mongoose.Types.ObjectId(), { status: 'pending' });
  me.restore();
  assert.equal(res.status, 422);
});

test('moderators cannot review code plans (stays a 403)', async () => {
  const me = signedInAs('moderator');
  const planId = new mongoose.Types.ObjectId();
  const planMock = mock.method(ContributionPlan, 'findById', async () => ({ _id: planId, projectId: new mongoose.Types.ObjectId(), authorId: new mongoose.Types.ObjectId(), status: 'submitted' }));
  const grantMock = mock.method(MaintainerGrant, 'findOne', async () => null);
  const projMock = mock.method(Project, 'findById', async () => ({ createdBy: new mongoose.Types.ObjectId() }));
  const res = await fetch(`${base}/api/contribution-plans/${planId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ decision: 'approved' }) });
  [planMock, grantMock, projMock].forEach((m) => m.mock.restore());
  me.restore();
  assert.equal(res.status, 403);
});
