import { splitIntoChunks } from './src/services/ingestion/index.js';

const text = Array(1200)
  .fill('This is sample documentation for testing ingestion.')
  .join(' ');

const chunks = splitIntoChunks(text, 500, 50);

console.log('Number of chunks:', chunks.length);
console.log('First chunk word count:', chunks[0].split(/\s+/).length);
console.log('Second chunk word count:', chunks[1].split(/\s+/).length);
console.log('Chunks are non-empty:', chunks.every(c => c.length > 0));