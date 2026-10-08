import { z } from 'zod';
import { REVIEW_DECISION } from '../constants.js';
import { objectId } from './common.js';

const evidenceItem = z
  .object({
    chunkId: objectId.optional(),
    filePath: z.string().trim().min(1).max(300),
    snapshotVersion: z.string().trim().min(1).max(40),
  })
  .strict();

// POST /api/contribution-plans  (contributor). Evidence from the snapshot is mandatory.
export const createPlanSchema = z
  .object({
    issueId: objectId,
    approach: z.string().trim().min(20, 'describe your approach in at least 20 characters').max(4000),
    steps: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    evidence: z.array(evidenceItem).min(1, 'cite at least one file from the snapshot').max(20),
  })
  .strict();

// POST /api/contribution-plans/:id/review  (maintainer of that project)
export const reviewSchema = z
  .object({
    decision: z.enum(REVIEW_DECISION),
    feedback: z.string().trim().max(2000).default(''),
  })
  .strict()
  .refine((v) => v.decision !== 'changes_requested' || v.feedback.length > 0, {
    message: 'feedback is required when requesting changes',
    path: ['feedback'],
  });
