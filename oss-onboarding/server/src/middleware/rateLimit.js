import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// Consistent JSON error shape (see errorHandler.js) with a 429 status.
function limiter({ windowMs, limit, code, message, keyByEmail = false, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req.ip ?? '');
      const email = keyByEmail && typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return email ? `${ip}|${email}` : ip;
    },
    handler: (req, res) => res.status(429).json({ error: { code, message } }),
  });
}

// Wrong passwords: 5 failures per IP+email per 15 minutes. Successful logins do not count.
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  code: 'too_many_login_attempts',
  message: 'Too many failed login attempts. Try again in 15 minutes.',
  keyByEmail: true,
  skipSuccessfulRequests: true,
});

// Per-IP backstop so one address cannot try many different accounts.
export const loginIpLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  code: 'too_many_login_attempts',
  message: 'Too many login attempts from this address. Try again later.',
  skipSuccessfulRequests: true,
});

export const signupLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  code: 'too_many_signups',
  message: 'Too many sign-up attempts. Try again later.',
});

export const accountEmailLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  code: 'too_many_requests',
  message: 'Too many requests. Try again later.',
  keyByEmail: true,
});
