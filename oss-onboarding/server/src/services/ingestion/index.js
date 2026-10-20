import { Document } from '../../models/Document.js';
import { Chunk } from '../../models/Chunk.js';

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

/**
 * Ingest document contents into MongoDB.
 * Each file must contain: filePath and content.
 */
export async function ingestDocuments({
  projectId,
  snapshotId,
  files,
  visibility = 'public',
}) {
  if (!projectId || !snapshotId || !Array.isArray(files)) {
    throw new Error('projectId, snapshotId, and files are required');
  }

  const results = [];

  for (const file of files) {
    const filePath = file.filePath?.replace(/\\/g, '/').trim();
    const content = file.content;

    if (!filePath || typeof content !== 'string' || !content.trim()) {
      continue;
    }

    // Skip environment files and paths that could expose secrets.
    const lowerPath = filePath.toLowerCase();
    if (
      lowerPath.split('/').some(part =>
        ['node_modules', '.git', 'dist', 'build'].includes(part)
      ) ||
      /(^|\/)\.env($|\.)/.test(lowerPath)
    ) {
      continue;
    }

    const title = file.title ||
      filePath.split('/').pop() ||
      'Untitled';

    // Create or update the document for this snapshot and path.
    const document = await Document.findOneAndUpdate(
      { snapshotId, filePath },
      {
        $set: {
          projectId,
          snapshotId,
          filePath,
          title,
          type: file.type || 'other',
          content,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    // Remove old chunks for this document before re-ingesting it.
    await Chunk.deleteMany({ documentId: document._id });

    const chunks = splitIntoChunks(content);
    let chunkIndex = 0;

    for (const chunkText of chunks) {
      const embedding = await generateEmbedding(chunkText);

      await Chunk.create({
        projectId,
        snapshotId,
        documentId: document._id,
        filePath,
        chunkIndex,
        text: chunkText,
        visibility,
        embedding,
      });

      chunkIndex++;
    }

    results.push({
      filePath,
      documentId: document._id,
      chunksCreated: chunkIndex,
    });
  }

  return {
    filesProcessed: results.length,
    totalChunks: results.reduce(
      (sum, result) => sum + result.chunksCreated,
      0,
    ),
    results,
  };
}
