import mongoose from 'mongoose';
import { DOC_TYPES } from '../constants.js';

const documentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot', required: true, index: true },
    filePath: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: DOC_TYPES, default: 'other' },
    content: { type: String, required: true },
  },
  { timestamps: true },
);
documentSchema.index({ snapshotId: 1, filePath: 1 }, { unique: true });

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);
