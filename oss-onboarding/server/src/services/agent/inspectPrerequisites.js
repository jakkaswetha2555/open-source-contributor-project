import mongoose from 'mongoose';
import { tool } from '@langchain/core/tools';
import { Issue } from '../../models/Issue.js';
import { Document } from '../../models/Document.js';
import { Snapshot } from '../../models/Snapshot.js';
import { toolArgSchemas } from '../../schemas/ai.js';

/**
 * Inspects prerequisites and setup requirements for a specific issue.
 * Queries the Issue, Document, and Snapshot collections for verified setup information.
 * Does not invent commands or documentation; clearly identifies missing setup info.
 * Read-only tool.
 */
export async function inspectPrerequisites(rawArgs = {}) {
  let issueId;
  try {
    const args = toolArgSchemas.inspectPrerequisites.parse(rawArgs);
    issueId = args.issueId;
  } catch (err) {
    return {
      found: false,
      error: 'Invalid issue ID format. Must be a 24-character hexadecimal string.',
      details: err.message,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    return {
      found: false,
      error: 'Invalid issue ID format. Must be a 24-character hexadecimal string.',
    };
  }

  const issue = await Issue.findById(issueId)
    .populate('projectId', 'name slug description repoUrl currentSnapshotId')
    .lean();

  if (!issue) {
    return {
      found: false,
      error: `Issue not found with ID: ${issueId}`,
    };
  }

  const projectId = issue.projectId?._id || issue.projectId;
  const snapshotId = issue.snapshotId || issue.projectId?.currentSnapshotId;

  // Retrieve snapshot version if snapshotId exists
  let snapshotVersion = 'v1';
  if (snapshotId && mongoose.Types.ObjectId.isValid(snapshotId)) {
    const snapshot = await Snapshot.findById(snapshotId).lean();
    if (snapshot?.version) {
      snapshotVersion = snapshot.version;
    }
  }

  // Look for setup, contributing, or readme documentation in Document collection
  let docs = [];
  if (projectId) {
    docs = await Document.find({
      projectId,
      type: { $in: ['setup', 'contributing', 'readme'] },
    }).lean();
  }

  const warnings = [];
  if (issue.staleSetupFlag) {
    warnings.push('Setup instructions flagged as stale by maintainers. Proceed with caution and verify dependencies.');
  }

  const setupDocs = docs.map((d) => ({
    filePath: d.filePath,
    title: d.title,
    type: d.type,
    summary: d.content ? d.content.slice(0, 300) : '',
  }));

  const evidence = setupDocs.length > 0
    ? setupDocs.map((d) => ({ filePath: d.filePath, snapshotVersion }))
    : [{ filePath: 'README.md', snapshotVersion }];

  const setupSteps = [];
  if (issue.prerequisites && issue.prerequisites.length > 0) {
    setupSteps.push(...issue.prerequisites);
  } else if (setupDocs.length > 0) {
    setupSteps.push('Review repository setup guide in ' + setupDocs[0].filePath);
  } else {
    setupSteps.push('Verify repository dependencies and development environment setup before starting');
  }

  const missingSetupInfo = setupDocs.length === 0 && (!issue.prerequisites || issue.prerequisites.length === 0);
  if (missingSetupInfo) {
    warnings.push('No documented setup guide or prerequisites found in the current project snapshot.');
  }

  return {
    found: true,
    issueId: issue._id.toString(),
    title: issue.title,
    summary: issue.summary,
    projectId: projectId ? projectId.toString() : null,
    projectName: issue.projectId?.name || 'Unknown Project',
    requiredSkills: issue.requiredSkills || [],
    prerequisites: issue.prerequisites || [],
    staleSetupFlag: Boolean(issue.staleSetupFlag),
    warnings,
    setupSteps,
    documentation: setupDocs,
    evidence,
    missingSetupInfo,
  };
}

export const inspectPrerequisitesTool = tool(
  async (args) => {
    const result = await inspectPrerequisites(args);
    return JSON.stringify(result);
  },
  {
    name: 'inspectPrerequisites',
    description: 'Inspects prerequisites, required skills, and setup documentation for a given issue ID.',
    schema: toolArgSchemas.inspectPrerequisites,
  },
);
