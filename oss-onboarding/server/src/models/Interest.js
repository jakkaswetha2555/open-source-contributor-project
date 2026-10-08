import mongoose from 'mongoose';

const interestSchema = new mongoose.Schema(
  {
    issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
interestSchema.index({ issueId: 1, userId: 1 }, { unique: true });

export const Interest = mongoose.models.Interest || mongoose.model('Interest', interestSchema);
