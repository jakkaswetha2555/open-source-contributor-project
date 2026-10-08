import mongoose from 'mongoose';
import { VISIBILITY } from '../constants.js';
import { embeddingField } from './shared.js';

const chunkSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    snapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Snapshot', required: true, index: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
    filePath: { type: String, required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    text: { type: String, required: true },
    // Copied from the project so the vector search can filter on it directly.
    visibility: { type: String, enum: VISIBILITY, default: 'public' },
    embedding: embeddingField,
  },
  { timestamps: true },
);

export const Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);
