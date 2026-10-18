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
  // Use Atlas Vector Search for issue matching. Turn on only after `npm run embed-issues` has stored real embeddings.
  ISSUE_VECTOR_SEARCH: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  // Optional SMTP connection URL, e.g. smtps://user:pass@smtp.example.com. Without it, emails are printed to the server log.
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Contributor Onboarding <no-reply@localhost>'),
  // Block login until the email is verified. Defaults to on in production, off for local demos.
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? process.env.NODE_ENV === 'production' : v === 'true')),

  // "Sign in with Google" (OAuth 2.0 authorization code flow). All three optional: when unset,
  // GET /api/auth/google replies 503 instead of the server failing to start. Get CLIENT_ID/SECRET
  // from https://console.cloud.google.com/apis/credentials (OAuth client, type "Web application").
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Must exactly match an "Authorized redirect URI" on that OAuth client, e.g.
  // http://localhost:5000/api/auth/google/callback in dev, or your deployed API URL + the same path.
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
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
