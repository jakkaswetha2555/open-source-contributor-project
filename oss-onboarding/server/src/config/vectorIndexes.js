// Atlas Vector Search index definitions. Create these in Atlas (Search > Create Search Index > JSON editor)
// on the matching collection. Owner of RAG/matching (25071A0567) finalizes them.
import { EMBEDDING_DIMENSIONS } from '../constants.js';

export const chunksVectorIndex = {
  name: 'chunks_vector_index',
  collection: 'chunks',
  definition: {
    fields: [
      { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
      { type: 'filter', path: 'projectId' },
      { type: 'filter', path: 'snapshotId' },
      { type: 'filter', path: 'visibility' },
    ],
  },
};

export const issuesVectorIndex = {
  name: 'issues_vector_index',
  collection: 'issues',
  definition: {
    fields: [
      { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
      { type: 'filter', path: 'projectId' },
      { type: 'filter', path: 'status' },
    ],
  },
};
