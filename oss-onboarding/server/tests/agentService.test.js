import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentRun } from '../src/models/AgentRun.js';
import { Issue } from '../src/models/Issue.js';
import { Document } from '../src/models/Document.js';
import { Snapshot } from '../src/models/Snapshot.js';
import { runOnboardingAgent } from '../src/services/agent/agentService.js';
import { agentRecommendationSchema } from '../src/schemas/ai.js';

const userId = '507f1f77bcf86cd799439001';
const projectId = '507f1f77bcf86cd799439002';
const issueId1 = '507f1f77bcf86cd799439011';
const issueId2 = '507f1f77bcf86cd799439012';

test('runOnboardingAgent: completes full workflow for "Find a task I can start this weekend"', async () => {
  const mockCandidate = {
    _id: new mongoose.Types.ObjectId(issueId1),
    title: 'Add README setup instructions',
    summary: 'Document local onboarding steps',
    status: 'open',
    ownerId: null,
    requiredSkills: ['markdown'],
    prerequisites: ['git'],
    staleSetupFlag: false,
    projectId: {
      _id: new mongoose.Types.ObjectId(projectId),
      name: 'Contributor Portal',
      slug: 'contributor-portal',
      repoUrl: 'https://github.com/test/repo',
    },
  };

  const loggedRuns = [];
  const loggedToolCalls = [];

  const runCreateMock = mock.method(AgentRun, 'create', async (doc) => {
    const created = {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      toolCalls: [],
      save: async () => {},
    };
    loggedRuns.push(created);
    return created;
  });

  const runUpdateMock = mock.method(AgentRun, 'findByIdAndUpdate', async (id, update) => {
    const run = loggedRuns.find((r) => r._id.equals(id)) || loggedRuns[0];
    if (update.$push?.toolCalls) {
      run.toolCalls.push(update.$push.toolCalls);
      loggedToolCalls.push(update.$push.toolCalls);
    }
    if (update.status) run.status = update.status;
    if (update.recommendation) run.recommendation = update.recommendation;
    return run;
  });

  const issueFindMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [mockCandidate],
      }),
    }),
  }));

  const issueFindByIdMock = mock.method(Issue, 'findById', (id) => ({
    populate: () => ({
      lean: async () => mockCandidate,
    }),
    lean: async () => mockCandidate,
  }));

  const docFindMock = mock.method(Document, 'find', () => ({
    lean: async () => [
      {
        filePath: 'README.md',
        title: 'Readme',
        type: 'readme',
        content: 'Setup steps',
      },
    ],
  }));

  const result = await runOnboardingAgent({
    userId,
    projectId,
    goal: 'Find a task I can start this weekend',
  });

  runCreateMock.mock.restore();
  runUpdateMock.mock.restore();
  issueFindMock.mock.restore();
  issueFindByIdMock.mock.restore();
  docFindMock.mock.restore();

  assert.equal(result.status, 'completed');
  assert.equal(result.recommendation.issueId, issueId1);
  assert.equal(result.recommendation.title, 'Add README setup instructions');
  assert.equal(result.recommendation.revisedFrom, null);

  // Validate that recommendation conforms to agentRecommendationSchema
  const validatedRec = agentRecommendationSchema.safeParse(result.recommendation);
  assert.equal(validatedRec.success, true);

  // Tool calls logged: findIssues, checkIssueAvailability, inspectPrerequisites, checkIssueAvailability (recheck)
  assert.ok(loggedToolCalls.length >= 3);
  assert.equal(loggedToolCalls[0].name, 'findIssues');
  assert.equal(loggedToolCalls[0].status, 'ok');
  assert.ok(typeof loggedToolCalls[0].durationMs === 'number');
  assert.ok(loggedToolCalls[0].resultSummary.includes('Found'));
});

test('runOnboardingAgent: rejects unavailable first candidate and selects second candidate', async () => {
  const candidate1Unavailable = {
    _id: new mongoose.Types.ObjectId(issueId1),
    title: 'Taken task',
    summary: 'Already assigned',
    status: 'assigned',
    ownerId: new mongoose.Types.ObjectId(),
    requiredSkills: ['node'],
    prerequisites: [],
    staleSetupFlag: false,
    projectId: { _id: new mongoose.Types.ObjectId(projectId), name: 'Portal' },
  };

  const candidate2Available = {
    _id: new mongoose.Types.ObjectId(issueId2),
    title: 'Open weekend bug fix',
    summary: 'Fix styling bug',
    status: 'open',
    ownerId: null,
    requiredSkills: ['css'],
    prerequisites: ['npm'],
    staleSetupFlag: false,
    projectId: { _id: new mongoose.Types.ObjectId(projectId), name: 'Portal' },
  };

  const loggedRuns = [];
  const runCreateMock = mock.method(AgentRun, 'create', async (doc) => {
    const created = {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      toolCalls: [],
    };
    loggedRuns.push(created);
    return created;
  });

  const runUpdateMock = mock.method(AgentRun, 'findByIdAndUpdate', async (id, update) => {
    const run = loggedRuns[0];
    if (update.$push?.toolCalls) run.toolCalls.push(update.$push.toolCalls);
    if (update.status) run.status = update.status;
    if (update.recommendation) run.recommendation = update.recommendation;
    return run;
  });

  const issueFindMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [candidate1Unavailable, candidate2Available],
      }),
    }),
  }));

  const issueFindByIdMock = mock.method(Issue, 'findById', (id) => {
    const strId = id.toString();
    const doc = strId === issueId1 ? candidate1Unavailable : candidate2Available;
    return {
      populate: () => ({
        lean: async () => doc,
      }),
      lean: async () => doc,
    };
  });

  const docFindMock = mock.method(Document, 'find', () => ({
    lean: async () => [],
  }));

  const result = await runOnboardingAgent({
    userId,
    projectId,
    goal: 'Find a task I can start this weekend',
  });

  runCreateMock.mock.restore();
  runUpdateMock.mock.restore();
  issueFindMock.mock.restore();
  issueFindByIdMock.mock.restore();
  docFindMock.mock.restore();

  // First candidate was rejected! Second candidate selected!
  assert.equal(result.status, 'completed');
  assert.equal(result.recommendation.issueId, issueId2);
  assert.equal(result.recommendation.revisedFrom, issueId1);
  assert.ok(result.recommendation.reasons.some((r) => r.includes(issueId1)));

  // Validate schema
  assert.equal(agentRecommendationSchema.safeParse(result.recommendation).success, true);
});

test('runOnboardingAgent: never recommends an unavailable issue when all candidates are assigned/closed', async () => {
  const candidateAssigned = {
    _id: new mongoose.Types.ObjectId(issueId1),
    title: 'Assigned task',
    summary: 'Already taken',
    status: 'assigned',
    ownerId: new mongoose.Types.ObjectId(),
    requiredSkills: [],
    prerequisites: [],
    projectId: { _id: new mongoose.Types.ObjectId(projectId), name: 'Portal' },
  };

  const loggedRuns = [];
  const runCreateMock = mock.method(AgentRun, 'create', async (doc) => {
    const created = { _id: new mongoose.Types.ObjectId(), ...doc, toolCalls: [] };
    loggedRuns.push(created);
    return created;
  });

  const runUpdateMock = mock.method(AgentRun, 'findByIdAndUpdate', async (id, update) => {
    const run = loggedRuns[0];
    if (update.$push?.toolCalls) run.toolCalls.push(update.$push.toolCalls);
    if (update.status) run.status = update.status;
    if (update.recommendation) run.recommendation = update.recommendation;
    return run;
  });

  const issueFindMock = mock.method(Issue, 'find', () => ({
    populate: () => ({
      limit: () => ({
        lean: async () => [candidateAssigned],
      }),
    }),
  }));

  const issueFindByIdMock = mock.method(Issue, 'findById', () => ({
    populate: () => ({
      lean: async () => candidateAssigned,
    }),
    lean: async () => candidateAssigned,
  }));

  const result = await runOnboardingAgent({
    userId,
    projectId,
    goal: 'Find a task I can start this weekend',
  });

  runCreateMock.mock.restore();
  runUpdateMock.mock.restore();
  issueFindMock.mock.restore();
  issueFindByIdMock.mock.restore();

  assert.equal(result.status, 'completed');
  assert.equal(result.recommendation.found, false);
  assert.equal(result.recommendation.issueId, undefined);
  assert.ok(result.recommendation.message.includes('unavailable'));
});

test('runOnboardingAgent: marks AgentRun as failed when unrecoverable database error occurs', async () => {
  const loggedRuns = [];
  const runCreateMock = mock.method(AgentRun, 'create', async (doc) => {
    const created = { _id: new mongoose.Types.ObjectId(), ...doc, toolCalls: [] };
    loggedRuns.push(created);
    return created;
  });

  let failedStatusSet = false;
  const runUpdateMock = mock.method(AgentRun, 'findByIdAndUpdate', async (id, update) => {
    if (update.status === 'failed') failedStatusSet = true;
    return loggedRuns[0];
  });

  // Simulate unexpected DB explosion in Issue.find
  const issueFindMock = mock.method(Issue, 'find', () => {
    throw new Error('Database connection lost during search');
  });

  await assert.rejects(async () => {
    await runOnboardingAgent({
      userId,
      projectId,
      goal: 'Find a task',
    });
  }, /Database connection lost/);

  runCreateMock.mock.restore();
  runUpdateMock.mock.restore();
  issueFindMock.mock.restore();

  assert.equal(failedStatusSet, true);
});
