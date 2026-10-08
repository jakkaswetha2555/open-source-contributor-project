import { z } from 'zod';
import { objectId, skillList } from './common.js';

// POST /api/contributor-chat
export const chatSchema = z
  .object({
    projectId: objectId,
    question: z.string().trim().min(3).max(1000),
  })
  .strict();

// POST /api/onboarding-agent
export const agentRequestSchema = z
  .object({
    projectId: objectId,
    goal: z.string().trim().min(3).max(300).default('Find a task I can start this weekend'),
    skills: skillList.optional(),
    hoursAvailable: z.number().min(1).max(80).optional(),
  })
  .strict();

// ---- Validation of STRUCTURED LLM OUTPUT (never trust model output) ----

export const citationSchema = z.object({
  filePath: z.string().min(1),
  snapshotVersion: z.string().min(1),
});

export const ragAnswerSchema = z.object({
  found: z.boolean(),
  answer: z.string().min(1),
  citations: z.array(citationSchema),
  snapshotVersion: z.string().min(1),
});

export const toolArgSchemas = {
  findIssues: z.object({ skills: skillList, projectId: objectId }).strict(),
  inspectPrerequisites: z.object({ issueId: objectId }).strict(),
  checkIssueAvailability: z.object({ issueId: objectId }).strict(),
};

export const agentRecommendationSchema = z.object({
  issueId: objectId,
  reasons: z.array(z.string().min(1)).min(1),
  setupSteps: z.array(z.string().min(1)),
  evidence: z.array(citationSchema).min(1),
  revisedFrom: objectId.nullable().default(null),
});
