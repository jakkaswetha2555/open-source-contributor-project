import mongoose from 'mongoose';

// A versioned documentation snapshot. RAG answers quote `version` when live repo state is unavailable.
const snapshotSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    version: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    source: { type: String, trim: true },
    commitRef: { type: String, trim: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
snapshotSchema.index({ projectId: 1, version: 1 }, { unique: true });

export const Snapshot = mongoose.models.Snapshot || mongoose.model('Snapshot', snapshotSchema);
