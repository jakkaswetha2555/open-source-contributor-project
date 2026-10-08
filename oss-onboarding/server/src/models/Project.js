import mongoose from 'mongoose';
import { VISIBILITY, VERIFICATION_STATUS } from '../constants.js';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 2000 },
    repoUrl: { type: String, trim: true },
    // Public snapshots are separated from private imports by this field.
    visibility: { type: String, enum: VISIBILITY, default: 'public', index: true },
    verificationStatus: { type: String, enum: VERIFICATION_STATUS, default: 'pending', index: true },
    currentSnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
