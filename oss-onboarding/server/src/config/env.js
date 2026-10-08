import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  CHAT_MODEL: z.string().default('llama3.1:8b'),
  EMBED_MODEL: z.string().default('nomic-embed-text'),
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

export const env = parsed.data;
