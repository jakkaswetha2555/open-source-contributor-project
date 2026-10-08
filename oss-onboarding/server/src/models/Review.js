import mongoose from 'mongoose';
import { REVIEW_DECISION } from '../constants.js';

const reviewSchema = new mongoose.Schema(
  {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPlan', required: true, index: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: REVIEW_DECISION, required: true },
    feedback: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true },
);

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
