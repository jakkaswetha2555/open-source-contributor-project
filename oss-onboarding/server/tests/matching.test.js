import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/test';
process.env.SESSION_SECRET ||= 'test-secret-test-secret';

const { scoreIssue, rankIssues, matchIssues } = await import('../src/services/matching/index.js');

const issue = (over = {}) => ({
  _id: Math.random().toString(16).slice(2).padEnd(24, '0'),
  projectId: 'p1',
  title: 'Add pagination to the query parser',
  summary: 'Implement cursor pagination',
  requiredSkills: ['JavaScript', 'Express'],
  prerequisites: ['Node.js 20 installed', 'Run npm install'],
  status: 'open',
  ownerId: null,
  ...over,
});

test('scoreIssue: reports matched and missing skills, case-insensitively', () => {
  const r = scoreIssue(issue(), { skills: ['javascript', 'python'] });
  assert.deepEqual(r.matchedSkills, ['javascript']);
  assert.deepEqual(r.missingSkills, ['express']);
  assert.ok(r.reasons.some((x) => x.startsWith('Matches your skills')));
});

test('scoreIssue: lists prerequisites to complete first and never claims an issue is easy', () => {
  const r = scoreIssue(issue(), { skills: ['javascript'] });
  assert.ok(r.reasons.some((x) => x.includes('Prerequisites to complete first')));
  assert.ok(!r.reasons.join(' ').toLowerCase().includes('easy'));
});

test('scoreIssue: stale setup instructions are surfaced as a reason', () => {
  const r = scoreIssue(issue({ staleSetupFlag: true }), { skills: ['javascript'] });
  assert.ok(r.reasons.some((x) => x.includes('out of date')));
});

test('rankIssues: assigned and closed issues are never returned (the demo scenario)', () => {
  const assigned = issue({ title: 'Best match but taken', ownerId: 'someone', status: 'assigned' });
  const free = issue({ title: 'Second best', requiredSkills: ['JavaScript'] });
  const out = rankIssues([assigned, issue({ status: 'closed' }), free], { skills: ['javascript', 'express'] });
  assert.equal(out.length, 1);
  assert.equal(out[0].issue.title, 'Second best');
});

test('rankIssues: orders by skill coverage and drops issues with no overlap', () => {
  const full = issue({ title: 'full', requiredSkills: ['a', 'b'] });
  const half = issue({ title: 'half', requiredSkills: ['a', 'z'] });
  const none = issue({ title: 'none', requiredSkills: ['q'] });
  const out = rankIssues([none, half, full], { skills: ['a', 'b'] });
  assert.deepEqual(out.map((r) => r.issue.title), ['full', 'half']);
});

test('rankIssues: respects the limit', () => {
  const many = Array.from({ length: 8 }, (_, i) => issue({ title: `i${i}`, requiredSkills: ['a'] }));
  assert.equal(rankIssues(many, { skills: ['a'] }, { limit: 3 }).length, 3);
});

const deps = (over = {}) => ({
  loadAllowedProjectIds: async () => ['p1'],
  keywordCandidates: async () => [issue({ requiredSkills: ['JavaScript'] })],
  vectorCandidates: async () => { throw new Error('should not be used'); },
  ...over,
});

test('matchIssues: no skills or interests -> no_profile', async () => {
  const r = await matchIssues({ user: { skills: [], interests: [] } }, deps());
  assert.equal(r.status, 'no_profile');
});

test('matchIssues: uses the saved profile and returns reasons', async () => {
  const r = await matchIssues({ user: { skills: ['javascript'], interests: [] } }, deps());
  assert.equal(r.status, 'ok');
  assert.equal(r.method, 'keyword');
  assert.equal(r.matches.length, 1);
  assert.ok(r.matches[0].reasons.length > 0);
});

test('matchIssues: a project the user may not see behaves like it does not exist (no private leakage)', async () => {
  let loaded = false;
  const r = await matchIssues(
    { user: { skills: ['javascript'] }, projectId: 'private-project-id' },
    deps({ keywordCandidates: async () => { loaded = true; return []; } }),
  );
  assert.equal(r.status, 'project_not_found');
  assert.equal(loaded, false, 'issues must not be read before authorization passes');
});

test('matchIssues: empty result when nothing matches', async () => {
  const r = await matchIssues({ user: { skills: ['cobol'] } }, deps());
  assert.deepEqual(r.matches, []);
});
