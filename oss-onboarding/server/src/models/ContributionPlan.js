import mongoose from 'mongoose';
import { PLAN_STATUS } from '../constants.js';

const evidenceSchema = new mongoose.Schema(
  {
    chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
    filePath: { type: String, required: true },
    snapshotVersion: { type: String, required: true },
  },
  { _id: false },
);

const contributionPlanSchema = new mongoose.Schema(
  {
    issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    // Only the author may edit a plan.
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    approach: { type: String, required: true, maxlength: 4000 },
    steps: { type: [String], default: [] },
    evidence: {
      type: [evidenceSchema],
      validate: { validator: (v) => v.length > 0, message: 'a plan needs at least one piece of evidence' },
    },
    status: { type: String, enum: PLAN_STATUS, default: 'submitted' },
  },
  { timestamps: true },
);
contributionPlanSchema.index({ projectId: 1, status: 1 });

export const ContributionPlan =
  mongoose.models.ContributionPlan || mongoose.model('ContributionPlan', contributionPlanSchema);
