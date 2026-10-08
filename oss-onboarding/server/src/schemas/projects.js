import { z } from 'zod';
import { ISSUE_STATUS, DOC_TYPES } from '../constants.js';
import { objectId, skillList } from './common.js';

const importedDocument = z
  .object({
    filePath: z.string().trim().min(1).max(300),
    title: z.string().trim().min(1).max(200),
    type: z.enum(DOC_TYPES).default('other'),
    content: z.string().min(1).max(200_000),
  })
  .strict();

const importedIssue = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(4000),
    requiredSkills: skillList.default([]),
    prerequisites: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
  })
  .strict();

// POST /api/projects/:id/imports  (maintainer of that project)
export const importSchema = z
  .object({
    version: z.string().trim().min(1).max(40),
    source: z.string().trim().max(300).optional(),
    documents: z.array(importedDocument).min(1).max(200),
    issues: z.array(importedIssue).max(200).default([]),
  })
  .strict();

// PATCH /api/issues/:id  (maintainer of that project)
export const updateIssueSchema = z
  .object({
    status: z.enum(ISSUE_STATUS).optional(),
    ownerId: objectId.nullable().optional(),
    staleSetupFlag: z.boolean().optional(),
    summary: z.string().trim().min(1).max(4000).optional(),
    prerequisites: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
    requiredSkills: skillList.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'provide at least one field to update' });

// PATCH /api/projects/:id/verification  (moderator)
export const verificationSchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

// POST /api/issues/:id/interest  (no body fields allowed)
export const interestSchema = z.object({}).strict();
