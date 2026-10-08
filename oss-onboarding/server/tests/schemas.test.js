import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signupSchema, createPlanSchema, reviewSchema, updateIssueSchema, chatSchema,
  agentRequestSchema, toolArgSchemas, ragAnswerSchema,
} from '../src/schemas/index.js';

const oid = '507f1f77bcf86cd799439011';

test('signup: staff role cannot be self-assigned', () => {
  const body = { email: 'a@b.com', name: 'A', password: 'a-long-password' };
  assert.equal(signupSchema.safeParse(body).success, true);
  assert.equal(signupSchema.safeParse({ ...body, role: 'moderator' }).success, false);
  assert.equal(signupSchema.safeParse({ ...body, password: 'short' }).success, false);
});

test('plan: evidence is mandatory, unknown fields rejected', () => {
  const ok = { issueId: oid, approach: 'x'.repeat(25), evidence: [{ filePath: 'CONTRIBUTING.md', snapshotVersion: 'v1' }] };
  assert.equal(createPlanSchema.safeParse(ok).success, true);
  assert.equal(createPlanSchema.safeParse({ ...ok, evidence: [] }).success, false);
  assert.equal(createPlanSchema.safeParse({ ...ok, authorId: oid }).success, false);
});

test('review: feedback required when requesting changes', () => {
  assert.equal(reviewSchema.safeParse({ decision: 'approved' }).success, true);
  assert.equal(reviewSchema.safeParse({ decision: 'changes_requested' }).success, false);
  assert.equal(reviewSchema.safeParse({ decision: 'changes_requested', feedback: 'Add tests' }).success, true);
});

test('issue update: needs at least one valid field', () => {
  assert.equal(updateIssueSchema.safeParse({}).success, false);
  assert.equal(updateIssueSchema.safeParse({ status: 'closed' }).success, true);
  assert.equal(updateIssueSchema.safeParse({ status: 'weird' }).success, false);
});

test('chat and agent request bodies', () => {
  assert.equal(chatSchema.safeParse({ projectId: oid, question: 'How do I run the tests?' }).success, true);
  assert.equal(chatSchema.safeParse({ projectId: 'nope', question: 'hi there' }).success, false);
  const agent = agentRequestSchema.parse({ projectId: oid });
  assert.equal(agent.goal, 'Find a task I can start this weekend');
});

test('LLM output and tool arguments are validated', () => {
  assert.equal(toolArgSchemas.checkIssueAvailability.safeParse({ issueId: oid }).success, true);
  assert.equal(toolArgSchemas.checkIssueAvailability.safeParse({ issueId: oid, extra: 1 }).success, false);
  const answer = { found: true, answer: 'Run npm test.', citations: [{ filePath: 'README.md', snapshotVersion: 'v1' }], snapshotVersion: 'v1' };
  assert.equal(ragAnswerSchema.safeParse(answer).success, true);
  assert.equal(ragAnswerSchema.safeParse({ ...answer, citations: 'none' }).success, false);
});
