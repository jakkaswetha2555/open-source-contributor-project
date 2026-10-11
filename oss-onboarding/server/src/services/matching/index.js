import mongoose from 'mongoose';
import { OllamaEmbeddings } from '@langchain/ollama';
import { env } from '../../config/env.js';
import { Project, Issue, MaintainerGrant } from '../../models/index.js';

const norm = (s) => String(s).trim().toLowerCase();
const uniq = (arr) => [...new Set(arr.map(norm).filter(Boolean))];

/**
 * Pure scoring of one issue against a contributor profile. Returns reasons, never a promise that
 * the issue is "easy": what we can honestly say is which skills overlap and what still has to be set up.
 */
export function scoreIssue(issue, profile) {
  const have = new Set(uniq(profile.skills ?? []));
  const interests = uniq(profile.interests ?? []);
  const required = uniq(issue.requiredSkills ?? []);

  const matchedSkills = required.filter((s) => have.has(s));
  const missingSkills = required.filter((s) => !have.has(s));

  const text = norm(`${issue.title} ${issue.summary}`);
  const matchedInterests = interests.filter((i) => text.includes(i));

  // Prerequisites are free text; list the ones that mention none of the contributor's skills as "to complete first".
  const prerequisitesToCheck = (issue.prerequisites ?? []).filter((p) => ![...have].some((s) => norm(p).includes(s)));

  const skillCoverage = required.length ? matchedSkills.length / required.length : 0;
  const interestBoost = interests.length ? matchedInterests.length / interests.length : 0;
  const score = Number((0.75 * skillCoverage + 0.25 * interestBoost).toFixed(4));

  const reasons = [];
  if (matchedSkills.length) reasons.push(`Matches your skills: ${matchedSkills.join(', ')}.`);
  if (matchedInterests.length) reasons.push(`Related to your interests: ${matchedInterests.join(', ')}.`);
  if (missingSkills.length) reasons.push(`Also uses skills not on your profile: ${missingSkills.join(', ')}.`);
  if (prerequisitesToCheck.length) reasons.push(`Prerequisites to complete first: ${prerequisitesToCheck.join('; ')}.`);
  if (issue.staleSetupFlag) reasons.push('A maintainer flagged the setup instructions as possibly out of date; confirm before starting.');
  if (!matchedSkills.length && !matchedInterests.length) reasons.push('No overlap with your listed skills or interests was found.');

  return { score, matchedSkills, missingSkills, prerequisitesToCheck, reasons };
}

/** Only open, unassigned issues are candidates. */
export function isAvailable(issue) {
  return issue.status === 'open' && !issue.ownerId;
}

/**
 * Pure ranking. `similarity` (0..1, from vector search) is blended in when present.
 * Issues with no overlap at all are dropped, so a weak list is shown as "no good match" instead of padding.
 */
export function rankIssues(issues, profile, { limit = 5 } = {}) {
  return issues
    .filter(isAvailable)
    .map((issue) => {
      const detail = scoreIssue(issue, profile);
      const similarity = typeof issue.similarity === 'number' ? issue.similarity : null;
      const finalScore = similarity === null ? detail.score : Number((0.6 * detail.score + 0.4 * similarity).toFixed(4));
      return { issue, ...detail, similarity, finalScore };
    })
    .filter((r) => r.matchedSkills.length > 0 || (r.similarity !== null && r.similarity > 0.5))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);
}

export const MATCH_SELECT = 'projectId title summary requiredSkills prerequisites status ownerId staleSetupFlag';

async function loadAllowedProjectIds(user) {
  // Public verified projects, plus private/unverified ones the user maintains. Authorization happens BEFORE any issue is read.
  const publicProjects = await Project.find({ visibility: 'public', verificationStatus: 'verified' }).select('_id');
  const ids = new Set(publicProjects.map((p) => String(p._id)));
  const grants = await MaintainerGrant.find({ userId: user._id, status: 'active' }).select('projectId');
  grants.forEach((g) => ids.add(String(g.projectId)));
  const created = await Project.find({ createdBy: user._id }).select('_id');
  created.forEach((p) => ids.add(String(p._id)));
  return [...ids];
}

async function vectorCandidates(queryText, projectIds, limit) {
  const embeddings = new OllamaEmbeddings({ baseUrl: env.OLLAMA_URL, model: env.EMBED_MODEL });
  const queryVector = await embeddings.embedQuery(queryText);
  return Issue.aggregate([
    {
      $vectorSearch: {
        index: 'issues_vector_index',
        path: 'embedding',
        queryVector,
        numCandidates: Math.max(100, limit * 20),
        limit: limit * 4,
        filter: { status: 'open', projectId: { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      },
    },
    { $addFields: { similarity: { $meta: 'vectorSearchScore' } } },
    { $project: { embedding: 0 } },
  ]);
}

async function keywordCandidates(projectIds) {
  return Issue.find({
    projectId: { $in: projectIds },
    status: 'open',
    $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
  })
    .select(MATCH_SELECT)
    .populate('projectId', 'name slug')
    .lean();
}

const defaultDeps = { loadAllowedProjectIds, vectorCandidates, keywordCandidates };

/**
 * Semantic issue matching: skills + interests -> open, unassigned issues the user may see, with reasons.
 * `method` tells the caller whether Atlas Vector Search or the keyword fallback produced the candidates.
 */
export async function matchIssues({ user, projectId, skills, interests, limit = 5 }, deps = defaultDeps) {
  const profile = {
    skills: skills ?? user.skills ?? [],
    interests: interests ?? user.interests ?? [],
  };
  if (profile.skills.length === 0 && profile.interests.length === 0) {
    return { status: 'no_profile', matches: [], method: null };
  }

  let allowed = await deps.loadAllowedProjectIds(user);
  if (projectId) {
    if (!allowed.includes(String(projectId))) return { status: 'project_not_found', matches: [], method: null };
    allowed = [String(projectId)];
  }
  if (allowed.length === 0) return { status: 'ok', matches: [], method: 'keyword' };

  let candidates;
  let method = 'keyword';
  if (env.ISSUE_VECTOR_SEARCH) {
    try {
      candidates = await deps.vectorCandidates([...profile.skills, ...profile.interests].join(', '), allowed, limit);
      method = 'vector';
    } catch (err) {
      console.error('[matching] vector search unavailable, using keyword fallback:', err.message);
    }
  }
  if (!candidates || candidates.length === 0) {
    candidates = await deps.keywordCandidates(allowed);
    method = 'keyword';
  }

  const ranked = rankIssues(candidates, profile, { limit });
  const matches = ranked.map((r) => ({
    issueId: String(r.issue._id),
    projectId: String(r.issue.projectId?._id ?? r.issue.projectId),
    title: r.issue.title,
    summary: r.issue.summary,
    score: r.finalScore,
    matchedSkills: r.matchedSkills,
    missingSkills: r.missingSkills,
    prerequisitesToCheck: r.prerequisitesToCheck,
    reasons: r.reasons,
  }));
  return { status: 'ok', matches, method };
}
