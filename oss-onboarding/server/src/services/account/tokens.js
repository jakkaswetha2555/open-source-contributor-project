import { createHash, randomBytes } from 'node:crypto';

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// The raw token goes in the email link; only its SHA-256 hash is stored, so a database leak is not enough to use it.
export function createToken(ttlMs) {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token), expires: new Date(Date.now() + ttlMs) };
}
