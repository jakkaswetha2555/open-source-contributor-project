import mongoose from 'mongoose';
import { tool } from '@langchain/core/tools';
import { Issue } from '../../models/Issue.js';
import { toolArgSchemas } from '../../schemas/ai.js';

/**
 * Searches the MongoDB Issue collection for open, unassigned issues.
 * Excludes assigned and closed issues.
 * Supports filtering by projectId, skills, goal keyword hints, and result limit.
 * Read-only tool.
 */
export async function findIssues(rawArgs = {}) {
  const args = toolArgSchemas.findIssues.parse(rawArgs);
  const { projectId, skills = [], goal, limit = 5 } = args;

  const query = {
    status: 'open',
    $or: [{ ownerId: null }, { ownerId: { $exists: false } }],
  };

  if (projectId) {
    query.projectId = new mongoose.Types.ObjectId(projectId);
  }

  const boundedLimit = Math.min(Math.max(limit, 1), 20);

  // If goal has specific search terms and no vector index is active, search title/summary
  if (goal && typeof goal === 'string' && goal.trim().length > 0) {
    const cleanGoal = goal.trim();
    // If not generic "find a task", check if there are specific keywords
    const keywords = cleanGoal
      .split(/\s+/)
      .map((k) => k.replace(/[^a-zA-Z0-9_-]/g, ''))
      .filter((k) => k.length > 3 && !['find', 'task', 'start', 'this', 'weekend', 'help'].includes(k.toLowerCase()));

    if (keywords.length > 0) {
      const regexPattern = keywords.join('|');
      query.$and = [
        {
          $or: [
            { title: { $regex: regexPattern, $options: 'i' } },
            { summary: { $regex: regexPattern, $options: 'i' } },
            { requiredSkills: { $in: keywords.map((k) => new RegExp(`^${k}$`, 'i')) } },
          ],
        },
      ];
    }
  }

  // Fetch candidate issues
  let candidateIssues = await Issue.find(query)
    .populate('projectId', 'name slug description repoUrl visibility')
    .limit(boundedLimit * 2)
    .lean();

  // If no issues found with specific keyword filter, retry without keyword filter to find open starter issues
  if (candidateIssues.length === 0 && query.$and) {
    delete query.$and;
    candidateIssues = await Issue.find(query)
      .populate('projectId', 'name slug description repoUrl visibility')
      .limit(boundedLimit * 2)
      .lean();
  }

  // Rank by skills if skills provided
  if (skills && skills.length > 0) {
    const skillSet = new Set(skills.map((s) => s.toLowerCase()));
    candidateIssues.sort((a, b) => {
      const aMatches = (a.requiredSkills || []).filter((s) => skillSet.has(s.toLowerCase())).length;
      const bMatches = (b.requiredSkills || []).filter((s) => skillSet.has(s.toLowerCase())).length;
      return bMatches - aMatches;
    });
  }

  const selectedIssues = candidateIssues.slice(0, boundedLimit);

  const formattedIssues = selectedIssues.map((issue) => {
    const staleSetupFlag = Boolean(issue.staleSetupFlag);
    return {
      issueId: issue._id.toString(),
      title: issue.title,
      summary: issue.summary,
      projectId: issue.projectId?._id ? issue.projectId._id.toString() : issue.projectId?.toString() || null,
      projectName: issue.projectId?.name || 'Project',
      projectSlug: issue.projectId?.slug || '',
      repoUrl: issue.projectId?.repoUrl || '',
      requiredSkills: issue.requiredSkills || [],
      prerequisites: issue.prerequisites || [],
      status: issue.status,
      ownerId: issue.ownerId ? issue.ownerId.toString() : null,
      staleSetupFlag,
      setupWarnings: staleSetupFlag
        ? ['Warning: Setup instructions have been flagged as stale by maintainers.']
        : [],
    };
  });

  return {
    issues: formattedIssues,
    count: formattedIssues.length,
    message: formattedIssues.length > 0
      ? `Found ${formattedIssues.length} candidate open issue(s).`
      : 'No suitable open issues found matching your criteria.',
  };
}

export const findIssuesTool = tool(
  async (args) => {
    const result = await findIssues(args);
    return JSON.stringify(result);
  },
  {
    name: 'findIssues',
    description: 'Finds open, unassigned contributor issues based on a goal, optional project ID, and skills.',
    schema: toolArgSchemas.findIssues,
  },
);
