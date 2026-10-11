// Stores real Ollama embeddings for every issue (the seed script stores placeholders).
// Usage: npm run embed-issues   (Ollama must be running with EMBED_MODEL pulled)
import { OllamaEmbeddings } from '@langchain/ollama';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Issue } from '../models/index.js';
import { EMBEDDING_DIMENSIONS } from '../constants.js';

await connectDb();
const embeddings = new OllamaEmbeddings({ baseUrl: env.OLLAMA_URL, model: env.EMBED_MODEL });
const issues = await Issue.find({});
let done = 0;
for (const issue of issues) {
  const text = [issue.title, issue.summary, (issue.requiredSkills ?? []).join(', '), (issue.prerequisites ?? []).join('; ')].join('\n');
  const vector = await embeddings.embedQuery(text);
  if (vector.length !== EMBEDDING_DIMENSIONS) throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`);
  await Issue.updateOne({ _id: issue._id }, { embedding: vector });
  done += 1;
}
console.log(`[embed-issues] embedded ${done} issues with ${env.EMBED_MODEL}`);
await disconnectDb();
