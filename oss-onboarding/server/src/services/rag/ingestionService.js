import { OllamaEmbeddings } from '@langchain/ollama';
import { EMBEDDING_DIMENSIONS } from '../../constants.js';
import { env } from '../../config/env.js';

export const DOCUMENT_CHUNK_SIZE = 1200;
export const DOCUMENT_CHUNK_OVERLAP = 150;

function validateChunkOptions(chunkSize, chunkOverlap) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new TypeError('Chunk size must be a positive integer');
  }
  if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new TypeError('Chunk overlap must be a non-negative integer smaller than chunk size');
  }
}

/**
 * Splits document text into overlapping character windows, preferring paragraph
 * and line boundaries when they are reasonably close to the target size.
 */
export function splitDocumentContent(
  content,
  { chunkSize = DOCUMENT_CHUNK_SIZE, chunkOverlap = DOCUMENT_CHUNK_OVERLAP } = {},
) {
  validateChunkOptions(chunkSize, chunkOverlap);
  if (typeof content !== 'string') throw new TypeError('Document content must be a string');

  const source = content.trim();
  if (!source) return [];

  const chunks = [];
  let start = 0;

  while (start < source.length) {
    let end = Math.min(start + chunkSize, source.length);
    if (end < source.length) {
      const minimumBoundary = start + Math.floor(chunkSize * 0.55);
      const paragraphBreak = source.lastIndexOf('\n\n', end - 2);
      if (paragraphBreak >= minimumBoundary) {
        end = paragraphBreak + 2;
      } else {
        const lineBreak = source.lastIndexOf('\n', end - 1);
        if (lineBreak >= minimumBoundary) end = lineBreak + 1;
      }
    }

    const text = source.slice(start, end).trim();
    if (text) chunks.push(text);
    if (end >= source.length) break;
    start = Math.max(start + 1, end - chunkOverlap);
  }

  return chunks;
}

async function embedDocumentTexts(texts) {
  const embeddings = new OllamaEmbeddings({
    baseUrl: env.OLLAMA_URL,
    model: env.EMBED_MODEL,
  });
  return embeddings.embedDocuments(texts);
}

/**
 * Prepare Chunk model records for one imported snapshot. Embedding happens
 * before the caller writes the new snapshot, documents, or chunks to MongoDB,
 * so an Ollama failure cannot make an incomplete snapshot current.
 */
export async function prepareSnapshotChunks(
  { projectId, snapshotId, visibility, documents },
  {
    embedDocuments = embedDocumentTexts,
    chunkSize = DOCUMENT_CHUNK_SIZE,
    chunkOverlap = DOCUMENT_CHUNK_OVERLAP,
  } = {},
) {
  if (!['public', 'private'].includes(visibility)) {
    throw new TypeError('Snapshot chunks require a valid project visibility');
  }
  if (!Array.isArray(documents)) {
    throw new TypeError('Snapshot documents must be an array');
  }

  const records = [];
  for (const document of documents) {
    if (!document?._id || !document.filePath) {
      throw new TypeError('Each snapshot document requires an ID and file path');
    }
    const textChunks = splitDocumentContent(document.content, { chunkSize, chunkOverlap });
    if (textChunks.length === 0) {
      throw new TypeError(`Document ${document.filePath} has no searchable text`);
    }
    textChunks.forEach((text, chunkIndex) => {
      records.push({
        projectId,
        snapshotId,
        documentId: document._id,
        filePath: document.filePath,
        chunkIndex,
        text,
        visibility,
      });
    });
  }

  if (records.length === 0) return [];

  const vectors = await embedDocuments(records.map((record) => record.text));
  if (!Array.isArray(vectors) || vectors.length !== records.length) {
    throw new TypeError('Ollama must return one embedding for every document chunk');
  }

  return records.map((record, index) => {
    const embedding = vectors[index];
    if (
      !Array.isArray(embedding)
      || embedding.length !== EMBEDDING_DIMENSIONS
      || !embedding.every(Number.isFinite)
    ) {
      throw new TypeError(
        `Document chunk embedding must contain ${EMBEDDING_DIMENSIONS} finite numbers`,
      );
    }
    return { ...record, embedding };
  });
}
