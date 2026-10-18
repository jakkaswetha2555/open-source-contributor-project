import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Project, Snapshot, Document, Chunk } from '../models/index.js';
import { chunksVectorIndex } from '../config/vectorIndexes.js';
import { searchChunks } from '../services/rag/ragService.js';
import { generateQueryEmbedding } from '../services/rag/ragService.js';

console.log('--- MongoDB Atlas & RAG Verification Script ---');
console.log(`Connecting to: ${env.MONGODB_URI.replace(/:([^@]+)@/, ':****@')}`);

try {
  await connectDb();
  console.log(`✔ Connected successfully to database: "${mongoose.connection.name}"`);

  // 1. Check collection counts
  const [projectCount, snapshotCount, docCount, chunkCount] = await Promise.all([
    Project.countDocuments(),
    Snapshot.countDocuments(),
    Document.countDocuments(),
    Chunk.countDocuments(),
  ]);

  console.log('\n--- Database Record Counts ---');
  console.log(`Projects:  ${projectCount}`);
  console.log(`Snapshots: ${snapshotCount}`);
  console.log(`Documents: ${docCount}`);
  console.log(`Chunks:    ${chunkCount}`);

  // 2. Check if active project and snapshot exist
  const activeProject = await Project.findOne({ currentSnapshotId: { $ne: null } });
  if (!activeProject) {
    console.log('\n⚠ Notice: No project with an active currentSnapshotId found.');
    console.log('  To seed initial data, run: npm run seed');
  } else {
    console.log(`\n✔ Active Project found: "${activeProject.name}" (ID: ${activeProject._id}, Visibility: ${activeProject.visibility})`);
    const activeSnapshot = await Snapshot.findById(activeProject.currentSnapshotId);
    console.log(`✔ Active Snapshot: version "${activeSnapshot?.version}" (ID: ${activeSnapshot?._id})`);

    // 3. Check chunks for this snapshot
    const snapshotChunks = await Chunk.countDocuments({ snapshotId: activeProject.currentSnapshotId });
    console.log(`✔ Chunks for active snapshot: ${snapshotChunks}`);

    if (snapshotChunks > 0) {
      console.log('\n--- Testing Vector Search ($vectorSearch) ---');
      try {
        console.log(`Generating embedding for test query: "How do I run tests?"`);
        const queryVector = await generateQueryEmbedding('How do I run tests?');
        console.log(`✔ Generated 768-dimensional query vector from Ollama`);

        console.log(`Executing searchChunks on index "${chunksVectorIndex.name}"...`);
        const searchResults = await searchChunks({
          projectId: activeProject._id,
          snapshotId: activeProject.currentSnapshotId,
          visibility: activeProject.visibility,
          queryVector,
          limit: 3,
        });

        console.log(`✔ $vectorSearch query executed successfully! Found ${searchResults.length} relevant chunks:`);
        for (const [i, chunk] of searchResults.entries()) {
          console.log(`  [${i + 1}] File: ${chunk.filePath} (Score: ${chunk.score?.toFixed(4) || 'N/A'})`);
        }
      } catch (searchErr) {
        console.error('\n✖ Vector search test failed:');
        console.error(`  ${searchErr.message}`);
        console.log('\nPossible causes:');
        console.log(`1. The search index "${chunksVectorIndex.name}" has not been created in Atlas.`);
        console.log(`2. The search index is still in the "BUILDING" state in Atlas.`);
        console.log(`3. The index definition fields do not match the expected schema.`);
      }
    }
  }

  console.log('\n✔ Verification run finished.');
} catch (err) {
  console.error('\n✖ Database connection error:');
  console.error(`  ${err.message}`);
  console.log('\nCheck:');
  console.log('1. Is your IP address allowed in MongoDB Atlas Network Access?');
  console.log('2. Are the database username and password in MONGODB_URI correct?');
  console.log('3. Is the Atlas cluster running and reachable?');
} finally {
  await disconnectDb();
}
