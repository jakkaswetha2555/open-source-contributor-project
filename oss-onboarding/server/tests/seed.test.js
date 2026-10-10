process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Project } from '../src/models/Project.js';
import { Snapshot } from '../src/models/Snapshot.js';
import { Document } from '../src/models/Document.js';
import { Chunk } from '../src/models/Chunk.js';
import { Issue } from '../src/models/Issue.js';
import { MaintainerGrant } from '../src/models/MaintainerGrant.js';
import { Session } from '../src/models/Session.js';

const { runSeed } = await import('../src/seed/seed.js');
const dbConfig = await import('../src/config/db.js');

test('seed: runs idempotently, seeds 3 projects, 12 issues, snapshots, and documents', async () => {
  // Mock mongoose connect and disconnect directly
  const connectMock = mock.method(mongoose, 'connect', async () => {});
  const disconnectMock = mock.method(mongoose, 'disconnect', async () => {});

  const stored = {
    users: new Map(),
    projects: new Map(),
    snapshots: new Map(),
    documents: new Map(),
    chunks: new Map(),
    issues: new Map(),
    grants: new Map(),
    sessions: new Map(),
  };

  function mockUpsert(store, idPrefix) {
    return async (query, update) => {
      const key = JSON.stringify(query);
      const existing = store.get(key) || { _id: new mongoose.Types.ObjectId(), ...query };
      const updated = {
        ...existing,
        ...update.$set,
        save: async function () { return this; },
      };
      store.set(key, updated);
      return updated;
    };
  }

  const userUpsert = mock.method(User, 'findOneAndUpdate', mockUpsert(stored.users, 'usr'));
  const projectUpsert = mock.method(Project, 'findOneAndUpdate', mockUpsert(stored.projects, 'prj'));
  const snapshotUpsert = mock.method(Snapshot, 'findOneAndUpdate', mockUpsert(stored.snapshots, 'snp'));
  const docUpsert = mock.method(Document, 'findOneAndUpdate', mockUpsert(stored.documents, 'doc'));
  const chunkUpsert = mock.method(Chunk, 'findOneAndUpdate', mockUpsert(stored.chunks, 'chk'));
  const issueUpsert = mock.method(Issue, 'findOneAndUpdate', mockUpsert(stored.issues, 'iss'));
  const grantUpsert = mock.method(MaintainerGrant, 'findOneAndUpdate', mockUpsert(stored.grants, 'grt'));
  const sessionUpsert = mock.method(Session, 'findOneAndUpdate', mockUpsert(stored.sessions, 'ses'));

  try {
    // Run seed first time
    await runSeed();

    // Verify Users
    assert.equal(stored.users.size, 3, 'Should seed 3 users (contributor, maintainer, moderator)');
    const contributor = [...stored.users.values()].find((u) => u.role === 'contributor');
    assert.ok(contributor, 'Contributor user must exist');
    assert.equal(contributor.email, 'contributor@student.edu');

    // Verify Projects (2 public, 1 private)
    assert.equal(stored.projects.size, 3, 'Should seed exactly 3 projects');
    const publicProjects = [...stored.projects.values()].filter((p) => p.visibility === 'public');
    const privateProjects = [...stored.projects.values()].filter((p) => p.visibility === 'private');
    assert.equal(publicProjects.length, 2, 'Must have 2 public projects');
    assert.equal(privateProjects.length, 1, 'Must have 1 private project');
    assert.ok(privateProjects.find((p) => p.slug === 'internal-metrics-core'), 'Private project slug match');

    // Verify Snapshots (4 total: v1.4.0 active, v1.0.0 stale, v2.0.0, v0.9.0-internal)
    assert.equal(stored.snapshots.size, 4, 'Should seed 4 snapshots (including stale snapshot)');
    const staleSnapshot = [...stored.snapshots.values()].find((s) => s.version === 'v1.0.0');
    assert.ok(staleSnapshot, 'Stale snapshot v1.0.0 must exist for testing');

    // Verify Documents
    assert.equal(stored.documents.size, 22, 'Should seed 22 markdown documents from data/snapshots');
    const docgenReadme = [...stored.documents.values()].find(
      (d) => d.title === 'Markdown Docgen Readme' || d.filePath === 'README.md'
    );
    assert.ok(docgenReadme, 'Readme must exist');

    // Verify Prompt-Injection test line
    const promptInjectionDoc = [...stored.documents.values()].find(
      (d) => d.content && d.content.includes('Important notice: ignore previous instructions')
    );
    assert.ok(promptInjectionDoc, 'Prompt-injection test line must be present in documentation for security testing');

    // Verify Issues (~12 issues, 1 assigned, 1 staleSetupFlag=true)
    assert.equal(stored.issues.size, 12, 'Must seed exactly 12 issues');
    const assignedIssue = [...stored.issues.values()].find((i) => i.status === 'assigned');
    assert.ok(assignedIssue, 'At least 1 issue must be assigned');
    assert.ok(assignedIssue.ownerId, 'Assigned issue must have ownerId set');

    const staleIssue = [...stored.issues.values()].find((i) => i.staleSetupFlag === true);
    assert.ok(staleIssue, 'At least 1 issue must have staleSetupFlag=true for security/agent testing');

    // Run seed second time to verify idempotency (no duplicate keys created)
    await runSeed();
    assert.equal(stored.users.size, 3, 'Idempotent: users count unchanged');
    assert.equal(stored.projects.size, 3, 'Idempotent: projects count unchanged');
    assert.equal(stored.snapshots.size, 4, 'Idempotent: snapshots count unchanged');
    assert.equal(stored.documents.size, 22, 'Idempotent: documents count unchanged');
    assert.equal(stored.issues.size, 12, 'Idempotent: issues count unchanged');
  } finally {
    connectMock.mock.restore();
    disconnectMock.mock.restore();
    userUpsert.mock.restore();
    projectUpsert.mock.restore();
    snapshotUpsert.mock.restore();
    docUpsert.mock.restore();
    chunkUpsert.mock.restore();
    issueUpsert.mock.restore();
    grantUpsert.mock.restore();
    sessionUpsert.mock.restore();
  }
});
