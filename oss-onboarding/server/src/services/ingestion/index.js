

import { OllamaEmbeddings } from '@langchain/ollama';

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



export function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error('Invalid chunk size or overlap');
  }

  const words = text.trim().split(/\s+/);
  const chunks = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));

    if (i + chunkSize >= words.length) {
      break;
    }
  }

  return chunks;
}
