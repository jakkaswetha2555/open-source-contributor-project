import mongoose from 'mongoose';
import { AgentRun } from '../../models/AgentRun.js';
import { findIssues } from './findIssues.js';
import { inspectPrerequisites } from './inspectPrerequisites.js';
import { checkIssueAvailability } from './checkIssueAvailability.js';

/**
 * Safely sanitizes tool arguments so no secrets or circular objects are logged.
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return {};
  const copy = { ...args };
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'key'];
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      copy[key] = '[REDACTED]';
    }
  }
  return copy;
}

/**
 * Creates a concise, human-readable summary of the tool output for logging.
 */
function summarizeToolResult(name, result) {
  if (!result) return 'No result';
  if (name === 'findIssues') {
    return `Found ${result.count ?? 0} candidate issues`;
  }
  if (name === 'checkIssueAvailability') {
    return result.available
      ? `Issue ${result.issueId} is open and available`
      : `Issue ${result.issueId} is unavailable (${result.reason || result.status})`;
  }
  if (name === 'inspectPrerequisites') {
    return result.found
      ? `Prerequisites inspected for ${result.issueId}. Skills: ${(result.requiredSkills || []).length}, Steps: ${(result.setupSteps || []).length}`
      : `Issue inspection failed: ${result.error}`;
  }
  return 'Tool executed successfully';
}

/**
 * Executes an agent tool call and appends the log record to the active AgentRun.
 */
async function callToolWithLogging(runId, toolName, args, executeFn) {
  const startedAt = new Date();
  const startTime = Date.now();
  let status = 'ok';
  let resultSummary = '';
  let result = null;

  try {
    result = await executeFn(args);
    resultSummary = summarizeToolResult(toolName, result);
    return result;
  } catch (err) {
    status = 'error';
    resultSummary = err.message || 'Tool execution encountered an error';
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    const toolCallRecord = {
      name: toolName,
      args: sanitizeArgs(args),
      status,
      resultSummary,
      startedAt,
      durationMs,
    };

    try {
      if (runId) {
        await AgentRun.findByIdAndUpdate(runId, {
          $push: { toolCalls: toolCallRecord },
        });
      }
    } catch (logErr) {
      // Do not abort workflow if logging tool call fails
      console.error('Failed to log tool call:', logErr.message);
    }
  }
}

/**
 * Main agent service coordinating findIssues, inspectPrerequisites, and checkIssueAvailability.
 * Implements deterministic onboarding advisory logic without arbitrary code execution.
 */
export async function runOnboardingAgent({
  userId,
  projectId = null,
  goal = 'Find a task I can start this weekend',
  skills = [],
  hoursAvailable,
  limit = 5,
}) {
  if (!userId) {
    const error = new Error('Authenticated user ID is required to run the onboarding agent');
    error.status = 401;
    error.code = 'unauthorized';
    throw error;
  }

  const safeUserId = new mongoose.Types.ObjectId(userId);
  const safeProjectId = projectId && mongoose.Types.ObjectId.isValid(projectId)
    ? new mongoose.Types.ObjectId(projectId)
    : undefined;

  // Step 1: Create an AgentRun in running state
  let run;
  try {
    run = await AgentRun.create({
      userId: safeUserId,
      projectId: safeProjectId,
      goal: (goal || 'Find a task I can start this weekend').slice(0, 500),
      status: 'running',
      toolCalls: [],
    });
  } catch (err) {
    console.error('Error creating AgentRun:', err.message);
    throw err;
  }

  try {
    // Step 2: Search for candidate issues using findIssues
    const searchArgs = {
      goal,
      limit: Math.max(limit, 5),
    };
    if (safeProjectId) {
      searchArgs.projectId = safeProjectId.toString();
    }
    if (skills && skills.length > 0) {
      searchArgs.skills = skills;
    }

    const searchResult = await callToolWithLogging(
      run._id,
      'findIssues',
      searchArgs,
      () => findIssues(searchArgs),
    );

    const candidates = searchResult?.issues || [];

    // If no candidate issues found
    if (candidates.length === 0) {
      const emptyRecommendation = {
        found: false,
        message: 'No suitable open issues found matching your criteria. Check back soon for new onboarding tasks.',
        reasons: ['No matching issues found in the repository issue collection.'],
        setupSteps: [],
        evidence: [{ filePath: 'README.md', snapshotVersion: 'v1' }],
        revisedFrom: null,
      };

      const completedRun = await AgentRun.findByIdAndUpdate(
        run._id,
        {
          recommendation: emptyRecommendation,
          status: 'completed',
        },
        { new: true },
      );

      return {
        runId: run._id.toString(),
        status: completedRun.status,
        recommendation: emptyRecommendation,
        toolCalls: completedRun.toolCalls,
      };
    }

    // Step 3: Iterate through candidates and reject unavailable issues
    let rejectedFirstCandidateId = null;
    let chosenCandidate = null;
    let prereqInfo = null;

    for (const candidate of candidates) {
      // 3a. Initial availability check
      const availability = await callToolWithLogging(
        run._id,
        'checkIssueAvailability',
        { issueId: candidate.issueId },
        () => checkIssueAvailability({ issueId: candidate.issueId }),
      );

      if (!availability.available) {
        if (!rejectedFirstCandidateId) {
          rejectedFirstCandidateId = candidate.issueId;
        }
        continue;
      }

      // 3b. Inspect prerequisites
      const prerequisites = await callToolWithLogging(
        run._id,
        'inspectPrerequisites',
        { issueId: candidate.issueId },
        () => inspectPrerequisites({ issueId: candidate.issueId }),
      );

      // 3c. Re-check availability right before final recommendation to prevent race conditions
      const finalAvailabilityCheck = await callToolWithLogging(
        run._id,
        'checkIssueAvailability',
        { issueId: candidate.issueId },
        () => checkIssueAvailability({ issueId: candidate.issueId }),
      );

      if (!finalAvailabilityCheck.available) {
        if (!rejectedFirstCandidateId) {
          rejectedFirstCandidateId = candidate.issueId;
        }
        continue;
      }

      // Candidate is valid, available, and inspected!
      chosenCandidate = candidate;
      prereqInfo = prerequisites;
      break;
    }

    // Step 4: Construct final recommendation
    let finalRecommendation;

    if (chosenCandidate) {
      const reasons = [
        `Aligned with contributor goal: "${goal}"`,
        chosenCandidate.requiredSkills.length > 0
          ? `Requires relevant skills: ${chosenCandidate.requiredSkills.join(', ')}`
          : 'Accessible to new contributors without strict prerequisites',
        'Verified as open, unassigned, and currently eligible for contribution',
      ];

      if (rejectedFirstCandidateId) {
        reasons.push(`Selected after rejecting earlier unavailable candidate (${rejectedFirstCandidateId})`);
      }

      const setupSteps = prereqInfo?.setupSteps && prereqInfo.setupSteps.length > 0
        ? prereqInfo.setupSteps
        : ['Clone repository', 'Install dependencies via npm install', 'Run npm test to verify environment'];

      const evidence = prereqInfo?.evidence && prereqInfo.evidence.length > 0
        ? prereqInfo.evidence
        : [{ filePath: 'README.md', snapshotVersion: 'v1' }];

      finalRecommendation = {
        issueId: chosenCandidate.issueId,
        title: chosenCandidate.title,
        summary: chosenCandidate.summary,
        project: {
          id: chosenCandidate.projectId,
          name: chosenCandidate.projectName,
          slug: chosenCandidate.projectSlug,
          repoUrl: chosenCandidate.repoUrl,
        },
        requiredSkills: chosenCandidate.requiredSkills,
        prerequisites: chosenCandidate.prerequisites,
        setupSteps,
        evidence,
        revisedFrom: rejectedFirstCandidateId ? rejectedFirstCandidateId : null,
        warnings: prereqInfo?.warnings || [],
        reasons,
        explanation: `Issue "${chosenCandidate.title}" in ${chosenCandidate.projectName} is a suitable starter issue for your goal. It is confirmed open and unassigned.`,
      };
    } else {
      // All candidates were examined and found to be unavailable
      finalRecommendation = {
        found: false,
        message: 'All candidate issues examined were currently unavailable (assigned or closed).',
        reasons: ['All candidate issues examined were currently unavailable (assigned or closed).'],
        setupSteps: [],
        evidence: [{ filePath: 'README.md', snapshotVersion: 'v1' }],
        revisedFrom: rejectedFirstCandidateId ? rejectedFirstCandidateId : null,
      };
    }

    // Step 5: Save recommendation and mark AgentRun as completed
    const completedRun = await AgentRun.findByIdAndUpdate(
      run._id,
      {
        recommendation: finalRecommendation,
        status: 'completed',
      },
      { new: true },
    );

    return {
      runId: run._id.toString(),
      status: completedRun.status,
      recommendation: finalRecommendation,
      toolCalls: completedRun.toolCalls,
    };
  } catch (err) {
    // Step 6: Mark AgentRun as failed on unexpected error
    try {
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'failed',
      });
    } catch (updateErr) {
      console.error('Failed to update AgentRun failure status:', updateErr.message);
    }
    throw err;
  }
}
