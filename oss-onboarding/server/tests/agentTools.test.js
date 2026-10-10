import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Issue } from '../src/models/Issue.js';
import { Document } from '../src/models/Document.js';
import { Snapshot } from '../src/models/Snapshot.js';
import {
  findIssues,
  findIssuesTool,
  inspectPrerequisites,
  inspectPrerequisitesTool,
  checkIssueAvailability,
  checkIssueAvailabilityTool,
} from '../src/services/agent/index.js';

const validProjectId = '507f1f77bcf86cd799439011';
const validIssueId = '507f1f77bcf86cd799439012';
const validIssueId2 = '507f1f77bcf86cd799439013';

// ---------------------------------------------------------
// TOOL 1: findIssues Tests
// ---------------------------------------------------------

test('findIssues: rejects invalid Zod inputs', async () => {
  // Invalid limit
  await assert.rejects(async () => {
    await findIssues({ limit: -5 });
  });

  // Invalid projectId
  await assert.rejects(async () => {
    await findIssues({ projectId: 'not-valid-id' });
  });

  // Extra unknown keys rejected by .strict()
  await assert.rejects(async () => {
    await findIssues({ unknownKey: 'hacked' });
  });
});

test('findIssues: discovers open unassigned issues and excludes assigned/closed', async () => {
  const mockIssues = [
    {
      _id: new mongoose.Types.ObjectId(validIssueId),
      title: 'Fix documentation typo',
      summary: 'Fix typos in quickstart guide',
      status: 'open',
      ownerId: null,
      requiredSkills: ['markdown', 'docs'],
      prerequisites: ['Clone repo'],
      staleSetupFlag: false,
      projectId: {
        _id: new mongoose.Types.ObjectId(validProjectId),
        name: 'Demo Project',
        slug: 'demo-project',
        repoUrl: 'https://github.com/example/demo',
      },
    },
  ];

  let queryCaptured = null;
  const findMock = mock.method(Issue, 'find', (q) => {
    queryCaptured = q;
    return {
      populate: () => ({
        limit: () => ({
          lean: async () => mockIssues,
        }),
      }),
    };
  });

  const result = await findIssues({
    projectId: validProjectId,
    skills: ['markdown'],
    goal: 'Find beginner docs task',
    limit: 5,
  });

  findMock.mock.restore();

  // Query must filter status: 'open' and ownerId: null
  assert.equal(queryCaptured.status, 'open');
  assert.ok(queryCaptured.$or);
  assert.equal(result.count, 1);
  assert.equal(result.issues[0].title, 'Fix documentation typo');
  assert.equal(result.issues[0].status, 'open');
  assert.equal(result.issues[0].ownerId, null);
  assert.equal(result.issues[0].projectName, 'Demo Project');
});

test('findIssues: returns safe empty result when no issues match in database', async () => {
  const findMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  }));

  const result = await findIssues({ goal: 'Anything' });
  findMock.mock.restore();

  assert.equal(result.count, 0);
  assert.equal(result.issues.length, 0);
  assert.equal(result.message, 'No suitable open issues found matching your criteria.');
});

test('findIssuesTool: LangChain tool runs successfully and returns valid JSON string', async () => {
  const findMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  }));

  const res = await findIssuesTool.invoke({ goal: 'Help with testing' });
  findMock.mock.restore();

  const parsed = JSON.parse(res);
  assert.equal(parsed.count, 0);
});

// ---------------------------------------------------------
// TOOL 2: inspectPrerequisites Tests
// ---------------------------------------------------------

test('inspectPrerequisites: inspects prerequisites and documentation for valid issue', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    title: 'Implement feature A',
    summary: 'Build feature A',
    requiredSkills: ['JavaScript', 'React'],
    prerequisites: ['Node.js 20+', 'npm'],
    staleSetupFlag: false,
    projectId: {
      _id: new mongoose.Types.ObjectId(validProjectId),
      name: 'Frontend Project',
      currentSnapshotId: '507f1f77bcf86cd799439099',
    },
  };

  const mockDocs = [
    {
      filePath: 'docs/setup.md',
      title: 'Setup Guide',
      type: 'setup',
      content: 'Run npm install then npm start',
    },
  ];

  const issueMock = mock.method(Issue, 'findById', () => ({
    populate: () => ({
      lean: async () => mockIssue,
    }),
  }));

  const docMock = mock.method(Document, 'find', () => ({
    lean: async () => mockDocs,
  }));

  const snapshotMock = mock.method(Snapshot, 'findById', () => ({
    lean: async () => ({ version: 'v2.1' }),
  }));

  const result = await inspectPrerequisites({ issueId: validIssueId });

  issueMock.mock.restore();
  docMock.mock.restore();
  snapshotMock.mock.restore();

  assert.equal(result.found, true);
  assert.equal(result.issueId, validIssueId);
  assert.deepEqual(result.requiredSkills, ['JavaScript', 'React']);
  assert.deepEqual(result.prerequisites, ['Node.js 20+', 'npm']);
  assert.equal(result.missingSetupInfo, false);
  assert.equal(result.staleSetupFlag, false);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].filePath, 'docs/setup.md');
  assert.equal(result.evidence[0].snapshotVersion, 'v2.1');
});

test('inspectPrerequisites: flags stale setup warning when staleSetupFlag is true', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    title: 'Legacy task',
    summary: 'Old task',
    requiredSkills: [],
    prerequisites: [],
    staleSetupFlag: true,
    projectId: { _id: new mongoose.Types.ObjectId(validProjectId), name: 'Legacy Repo' },
  };

  const issueMock = mock.method(Issue, 'findById', () => ({
    populate: () => ({
      lean: async () => mockIssue,
    }),
  }));

  const docMock = mock.method(Document, 'find', () => ({
    lean: async () => [],
  }));

  const result = await inspectPrerequisites({ issueId: validIssueId });

  issueMock.mock.restore();
  docMock.mock.restore();

  assert.equal(result.found, true);
  assert.equal(result.staleSetupFlag, true);
  assert.ok(result.warnings.some((w) => w.includes('stale')));
  assert.equal(result.missingSetupInfo, true);
});

test('inspectPrerequisites: safely handles invalid issue ID format and missing issue', async () => {
  // Invalid format
  const badIdResult = await inspectPrerequisites({ issueId: 'invalid-id' });
  assert.equal(badIdResult.found, false);
  assert.ok(badIdResult.error.includes('Invalid issue ID'));

  // Missing issue record
  const issueMock = mock.method(Issue, 'findById', () => ({
    populate: () => ({
      lean: async () => null,
    }),
  }));

  const missingResult = await inspectPrerequisites({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(missingResult.found, false);
  assert.ok(missingResult.error.includes('not found'));
});

// ---------------------------------------------------------
// TOOL 3: checkIssueAvailability Tests
// ---------------------------------------------------------

test('checkIssueAvailability: correctly identifies open and unassigned issue as available', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    status: 'open',
    ownerId: null,
  };

  const issueMock = mock.method(Issue, 'findById', () => ({
    lean: async () => mockIssue,
  }));

  const result = await checkIssueAvailability({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(result.available, true);
  assert.equal(result.status, 'open');
  assert.equal(result.reason, 'Issue is currently open and unassigned.');
});

test('checkIssueAvailability: rejects assigned issue as unavailable', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    status: 'assigned',
    ownerId: new mongoose.Types.ObjectId(),
  };

  const issueMock = mock.method(Issue, 'findById', () => ({
    lean: async () => mockIssue,
  }));

  const result = await checkIssueAvailability({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(result.available, false);
  assert.equal(result.status, 'assigned');
  assert.ok(result.reason.includes('assigned'));
});

test('checkIssueAvailability: rejects closed issue as unavailable', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    status: 'closed',
    ownerId: null,
  };

  const issueMock = mock.method(Issue, 'findById', () => ({
    lean: async () => mockIssue,
  }));

  const result = await checkIssueAvailability({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(result.available, false);
  assert.equal(result.status, 'closed');
  assert.ok(result.reason.includes('closed'));
});

test('checkIssueAvailability: rejects issue with ownerId even if status was open', async () => {
  const mockIssue = {
    _id: new mongoose.Types.ObjectId(validIssueId),
    status: 'open',
    ownerId: new mongoose.Types.ObjectId(),
  };

  const issueMock = mock.method(Issue, 'findById', () => ({
    lean: async () => mockIssue,
  }));

  const result = await checkIssueAvailability({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(result.available, false);
  assert.ok(result.reason.includes('assigned owner'));
});

test('checkIssueAvailability: safely handles invalid IDs and missing records', async () => {
  // Invalid format
  const badIdResult = await checkIssueAvailability({ issueId: 'bad-format' });
  assert.equal(badIdResult.available, false);
  assert.equal(badIdResult.status, 'invalid');

  // Missing record
  const issueMock = mock.method(Issue, 'findById', () => ({
    lean: async () => null,
  }));

  const notFoundResult = await checkIssueAvailability({ issueId: validIssueId });
  issueMock.mock.restore();

  assert.equal(notFoundResult.available, false);
  assert.equal(notFoundResult.status, 'not_found');
});
