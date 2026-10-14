import mongoose from 'mongoose';
import { OllamaEmbeddings } from '@langchain/ollama';
import { env } from '../../config/env.js';
import { EMBEDDING_DIMENSIONS } from '../../constants.js';
import { Chunk } from '../../models/Chunk.js';

export const CHUNK_MAX_SIZE = 1200;
export const CHUNK_OVERLAP = 150;

/**
 * Validates that an embedding vector is an array of exactly expectedDim finite numbers.
 */
export function validateEmbedding(embedding, expectedDim = EMBEDDING_DIMENSIONS) {
  if (!Array.isArray(embedding)) {
    throw new Error(`Embedding must be an array, received ${typeof embedding}`);
  }
  if (embedding.length !== expectedDim) {
    throw new Error(`Embedding must have ${expectedDim} dimensions, received ${embedding.length}`);
  }
  for (let i = 0; i < embedding.length; i++) {
    const val = embedding[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new Error(`Embedding element at index ${i} is not a finite number`);
    }
  }
  return true;
}

/**
 * Splits text into bounded chunks respecting paragraph and line breaks where possible.
 */
export function splitTextIntoChunks(text, maxSize = CHUNK_MAX_SIZE, overlap = CHUNK_OVERLAP) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.length <= maxSize) {
    return [trimmed];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < trimmed.length) {
    let endIndex = startIndex + maxSize;

    if (endIndex >= trimmed.length) {
      chunks.push(trimmed.slice(startIndex).trim());
      break;
    }

    // Attempt to break at paragraph boundary, line boundary, or whitespace
    const searchSlice = trimmed.slice(startIndex, endIndex);
    let breakPoint = searchSlice.lastIndexOf('\n\n');
    if (breakPoint === -1 || breakPoint < maxSize * 0.4) {
      breakPoint = searchSlice.lastIndexOf('\n');
    }
    if (breakPoint === -1 || breakPoint < maxSize * 0.4) {
      breakPoint = searchSlice.lastIndexOf(' ');
    }

    if (breakPoint > 0 && breakPoint >= maxSize * 0.4) {
      chunks.push(trimmed.slice(startIndex, startIndex + breakPoint).trim());
      startIndex = Math.max(startIndex + breakPoint + 1 - overlap, startIndex + 1);
    } else {
      chunks.push(trimmed.slice(startIndex, endIndex).trim());
      startIndex = endIndex - overlap;
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Chunks a single document object, returning chunk objects with file path and chunkIndex.
 */
export function chunkDocument(doc, options = {}) {
  const { maxSize = CHUNK_MAX_SIZE, overlap = CHUNK_OVERLAP } = options;
  if (!doc || !doc.content) return [];

  const textChunks = splitTextIntoChunks(doc.content, maxSize, overlap);
  return textChunks.map((text, chunkIndex) => ({
    documentId: doc._id || doc.id || undefined,
    filePath: doc.filePath || 'unknown',
    chunkIndex,
    text,
  }));
}

/**
 * Chunks an array of documents, generating numbered chunks for each document.
 */
export function chunkDocuments(documents = [], options = {}) {
  const allChunks = [];
  for (const doc of documents) {
    const docChunks = chunkDocument(doc, options);
    allChunks.push(...docChunks);
  }
  return allChunks;
}

/**
 * Generates vector embeddings for an array of texts using Ollama nomic-embed-text.
 * Rejects vectors that are not 768-dimensional finite numbers.
 */
export async function generateEmbeddings(texts = [], options = {}) {
  if (!texts || texts.length === 0) return [];

  const baseUrl = options.baseUrl || env.OLLAMA_URL;
  const model = options.model || env.EMBED_MODEL;

  const embeddings = new OllamaEmbeddings({
    baseUrl,
    model,
  });

  let vectors;
  try {
    vectors = await embeddings.embedDocuments(texts);
  } catch (err) {
    const error = new Error(`Failed to generate embeddings from Ollama (${baseUrl}, model: ${model}): ${err.message}`);
    error.status = 502;
    error.code = 'ollama_error';
    throw error;
  }

  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    const error = new Error(`Ollama returned invalid embedding count: expected ${texts.length}, got ${vectors?.length}`);
    error.status = 502;
    error.code = 'ollama_error';
    throw error;
  }

  // Validate all returned vectors have correct dimensions and finite values
  for (let i = 0; i < vectors.length; i++) {
    try {
      validateEmbedding(vectors[i], EMBEDDING_DIMENSIONS);
    } catch (valErr) {
      const error = new Error(`Invalid embedding vector for text index ${i}: ${valErr.message}`);
      error.status = 502;
      error.code = 'invalid_embedding_dimensions';
      throw error;
    }
  }

  return vectors;
}

/**
 * Ingests documents for a snapshot: chunks content, embeds vectors via Ollama,
 * and saves Chunk records to MongoDB with project metadata, snapshotId, and visibility.
 */
export async function ingestSnapshotDocuments({
  projectId,
  snapshotId,
  documents = [],
  visibility = 'public',
  ollamaOptions = {},
}) {
  if (!projectId || !snapshotId) {
    throw new Error('projectId and snapshotId are required for ingestion');
  }

  if (!documents || documents.length === 0) {
    return [];
  }

  // 1. Chunk documents
  const chunkDefs = chunkDocuments(documents);
  if (chunkDefs.length === 0) {
    return [];
  }

  // 2. Generate embeddings for all chunk texts
  const texts = chunkDefs.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts, ollamaOptions);

  // 3. Prepare Chunk models
  const chunkDocs = chunkDefs.map((c, i) => ({
    projectId: new mongoose.Types.ObjectId(projectId),
    snapshotId: new mongoose.Types.ObjectId(snapshotId),
    documentId: c.documentId ? new mongoose.Types.ObjectId(c.documentId) : new mongoose.Types.ObjectId(),
    filePath: c.filePath,
    chunkIndex: c.chunkIndex,
    text: c.text,
    visibility,
    embedding: embeddings[i],
  }));

  // 4. Clear any existing chunks for this snapshot to prevent duplicates on retries
  await Chunk.deleteMany({ snapshotId: new mongoose.Types.ObjectId(snapshotId) });

  // 5. Save chunks to database
  const savedChunks = await Chunk.insertMany(chunkDocs);
  return savedChunks;
}
