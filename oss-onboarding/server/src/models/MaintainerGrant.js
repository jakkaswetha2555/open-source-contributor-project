import mongoose from 'mongoose';
import { GRANT_STATUS } from '../constants.js';

// The ONLY way a user becomes a maintainer of a project (controlled approval flow).
const maintainerGrantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: GRANT_STATUS, default: 'pending' },
  },
  { timestamps: true },
);
maintainerGrantSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export const MaintainerGrant =
  mongoose.models.MaintainerGrant || mongoose.model('MaintainerGrant', maintainerGrantSchema);
