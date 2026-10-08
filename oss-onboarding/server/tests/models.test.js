import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User, Issue, ContributionPlan, Chunk, Session } from '../src/models/index.js';
import { EMBEDDING_DIMENSIONS } from '../src/constants.js';

const id = () => new mongoose.Types.ObjectId();

test('user: invalid role is rejected, default role is contributor', () => {
  const bad = new User({ email: 'a@b.com', name: 'A', passwordHash: 'x', role: 'admin' });
  assert.ok(bad.validateSync()?.errors.role);
  const ok = new User({ email: 'A@B.com', name: 'A', passwordHash: 'x' });
  assert.equal(ok.validateSync(), undefined);
  assert.equal(ok.role, 'contributor');
  assert.equal(ok.email, 'a@b.com');
});

test('issue: invalid status rejected, embedding must be 768 dims', () => {
  const base = { projectId: id(), title: 't', summary: 's' };
  assert.ok(new Issue({ ...base, status: 'done' }).validateSync()?.errors.status);
  assert.ok(new Issue({ ...base, embedding: [0.1, 0.2] }).validateSync()?.errors.embedding);
  const good = new Issue({ ...base, embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.1) });
  assert.equal(good.validateSync(), undefined);
});

test('contribution plan: requires at least one piece of evidence', () => {
  const base = { issueId: id(), projectId: id(), authorId: id(), approach: 'x'.repeat(30) };
  assert.ok(new ContributionPlan({ ...base, evidence: [] }).validateSync()?.errors.evidence);
  const ok = new ContributionPlan({ ...base, evidence: [{ filePath: 'README.md', snapshotVersion: 'v1' }] });
  assert.equal(ok.validateSync(), undefined);
});

test('chunk and session: required fields enforced', () => {
  assert.ok(new Chunk({}).validateSync());
  assert.ok(new Session({}).validateSync());
});
