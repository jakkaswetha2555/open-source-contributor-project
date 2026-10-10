import mongoose from 'mongoose';
import { tool } from '@langchain/core/tools';
import { Issue } from '../../models/Issue.js';
import { toolArgSchemas } from '../../schemas/ai.js';

/**
 * Checks whether an issue is currently open and unassigned.
 * Rejects closed or assigned issues, or issues with an active ownerId.
 * Read-only tool: does not modify status, reserve, or assign the issue.
 */
export async function checkIssueAvailability(rawArgs = {}) {
  let issueId;
  try {
    const args = toolArgSchemas.checkIssueAvailability.parse(rawArgs);
    issueId = args.issueId;
  } catch (err) {
    return {
      issueId: rawArgs?.issueId || null,
      available: false,
      status: 'invalid',
      reason: 'Invalid issue ID format. Must be a 24-character hexadecimal string.',
    };
  }

  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    return {
      issueId,
      available: false,
      status: 'invalid',
      reason: 'Invalid issue ID format. Must be a 24-character hexadecimal string.',
    };
  }

  const issue = await Issue.findById(issueId).lean();

  if (!issue) {
    return {
      issueId,
      available: false,
      status: 'not_found',
      reason: `Issue with ID ${issueId} does not exist in the database.`,
    };
  }

  // Check closed status
  if (issue.status === 'closed') {
    return {
      issueId: issue._id.toString(),
      available: false,
      status: 'closed',
      reason: 'Issue is marked as closed and is not accepting contributions.',
    };
  }

  // Check assigned status
  if (issue.status === 'assigned') {
    return {
      issueId: issue._id.toString(),
      available: false,
      status: 'assigned',
      reason: 'Issue is already assigned to a contributor.',
    };
  }

  // Check if ownerId is assigned
  if (issue.ownerId) {
    return {
      issueId: issue._id.toString(),
      available: false,
      status: issue.status,
      reason: 'Issue has an assigned owner and is not available.',
    };
  }

  // Check if status is open and unassigned
  if (issue.status === 'open') {
    return {
      issueId: issue._id.toString(),
      available: true,
      status: 'open',
      reason: 'Issue is currently open and unassigned.',
    };
  }

  return {
    issueId: issue._id.toString(),
    available: false,
    status: issue.status,
    reason: `Issue is not available (status: ${issue.status}).`,
  };
}

export const checkIssueAvailabilityTool = tool(
  async (args) => {
    const result = await checkIssueAvailability(args);
    return JSON.stringify(result);
  },
  {
    name: 'checkIssueAvailability',
    description: 'Checks if an issue is open and unassigned. Rejects assigned or closed issues.',
    schema: toolArgSchemas.checkIssueAvailability,
  },
);
