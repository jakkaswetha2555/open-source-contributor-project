import { EMBEDDING_DIMENSIONS } from '../constants.js';

// Embeddings are hidden by default so they never leak into API responses.
export const embeddingField = {
  type: [Number],
  default: undefined,
  select: false,
  validate: {
    validator: (v) => !v || v.length === 0 || v.length === EMBEDDING_DIMENSIONS,
    message: `embedding must have ${EMBEDDING_DIMENSIONS} dimensions`,
  },
};
