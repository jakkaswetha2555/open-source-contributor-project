
import { generateEmbedding } from './src/services/ingestion/index.js';

try {
  const vector = await generateEmbedding(
    'To install the project, run npm install.',
  );

  console.log('Embedding generated successfully!');
  console.log('Vector dimensions:', vector.length);
  console.log('First 5 numbers:', vector.slice(0, 5));
} catch (error) {
  console.error('Embedding test failed:', error.message);
}
