import mongoose from 'mongoose';
import { ISSUE_STATUS } from '../constants.js';
import { embeddingField } from './shared.js';

const issueSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 4000 },
    requiredSkills: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    status: { type: String, enum: ISSUE_STATUS, default: 'open' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Maintainers flag stale setup instructions instead of silently editing them.
    staleSetupFlag: { type: Boolean, default: false },
    embedding: embeddingField,
  },
  { timestamps: true },
);
issueSchema.index({ projectId: 1, status: 1 });

export const Issue = mongoose.models.Issue || mongoose.model('Issue', issueSchema);
