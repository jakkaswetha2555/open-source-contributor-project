

import { OllamaEmbeddings } from '@langchain/ollama';
import { getEncoding } from 'js-tiktoken';

const embeddings = new OllamaEmbeddings({
  baseUrl: 'http://localhost:11434',
  model: 'nomic-embed-text',
});

export async function generateEmbedding(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Text must be a non-empty string');
  }

  const vector = await embeddings.embedQuery(text);

  if (vector.length !== 768) {
    throw new Error(`Expected 768 dimensions, got ${vector.length}`);
  }

  return vector;
}




const encoding = getEncoding('cl100k_base');

export function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  if (
    !Number.isInteger(chunkSize) ||
    !Number.isInteger(overlap) ||
    chunkSize <= 0 ||
    overlap < 0 ||
    overlap >= chunkSize
  ) {
    throw new Error('Invalid chunk size or overlap');
  }

  const tokens = encoding.encode(text.trim());
  const chunks = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < tokens.length; i += step) {
    const chunkTokens = tokens.slice(i, i + chunkSize);
    chunks.push(encoding.decode(chunkTokens));

    if (i + chunkSize >= tokens.length) {
      break;
    }
  }

  return chunks;
}