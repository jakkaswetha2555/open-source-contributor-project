import { Router } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { User, Session } from '../models/index.js';
import { env } from '../config/env.js';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

function googleConfigured() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
}

function notConfigured(res) {
  return res.status(503).json({
    error: {
      code: 'oauth_not_configured',
      message: 'Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL.',
    },
  });
}

async function defaultExchangeCode({ code }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Google token exchange failed (${res.status}): ${body}`);
    err.status = 502;
    err.code = 'google_token_exchange_failed';
    throw err;
  }
  return res.json();
}

async function defaultFetchProfile({ accessToken }) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`Could not fetch Google profile (${res.status})`);
    err.status = 502;
    err.code = 'google_profile_fetch_failed';
    throw err;
  }
  const data = await res.json();
  return {
    googleId: data.sub,
    email: data.email,
    emailVerified: data.email_verified !== false,
    name: data.name,
  };
}

/**
 * "Sign in with Google" — standard OAuth 2.0 authorization code flow, no extra dependency.
 * Factory + injectable exchangeCode/fetchProfile so tests can mock the two outbound HTTP
 * calls to Google without hitting the real network (same pattern as createContributorChatRouter).
 */
export function createGoogleAuthRouter({
  exchangeCode = defaultExchangeCode,
  fetchProfile = defaultFetchProfile,
} = {}) {
  const router = Router();

  // GET /api/auth/google — redirect the browser to Google's consent screen.
  router.get('/auth/google', (req, res) => {
    if (!googleConfigured()) return notConfigured(res);

    const state = randomBytes(24).toString('hex');
    // Short-lived, path-scoped cookie: protects the OAuth flow itself from CSRF.
    // Path matches both this route and /callback (cookie paths match by prefix).
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: '/api/auth/google',
    });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
  });

  // GET /api/auth/google/callback — Google redirects back here with ?code&state.
  router.get('/auth/google/callback', async (req, res, next) => {
    if (!googleConfigured()) return notConfigured(res);

    const expectedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/api/auth/google' });

    try {
      const { code, state, error: deniedReason } = req.query;

      if (deniedReason) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login?error=google_oauth_denied`);
      }
      if (!code || !state || !expectedState || state !== expectedState) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login?error=google_oauth_invalid_state`);
      }

      const tokens = await exchangeCode({ code: String(code) });
      if (!tokens?.access_token) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login?error=google_oauth_failed`);
      }

      const profile = await fetchProfile({ accessToken: tokens.access_token, idToken: tokens.id_token });
      if (!profile?.googleId || !profile?.email) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login?error=google_oauth_failed`);
      }
      if (!profile.emailVerified) {
        return res.redirect(`${env.CLIENT_ORIGIN}/login?error=google_email_unverified`);
      }

      // Find by googleId first (returning user), then fall back to linking an existing
      // email/password account with the same email, then finally create a brand-new user.
      let user = await User.findOne({ googleId: profile.googleId });
      if (!user) {
        user = await User.findOne({ email: profile.email });
        if (user) {
          user.googleId = profile.googleId;
          if (!user.emailVerified) user.emailVerified = true;
          await user.save();
        } else {
          user = await User.create({
            email: profile.email,
            name: profile.name || profile.email.split('@')[0],
            googleId: profile.googleId,
            role: 'contributor',
            emailVerified: true,
          });
        }
      }

      const sessionToken = randomBytes(32).toString('hex');
      const csrfToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

      await Session.create({
        userId: user._id,
        tokenHash,
        csrfToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.cookie('sid', sessionToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION,
      });

      // Full-page redirect can't carry a JSON body, so the CSRF token the client needs for
      // future POST/PATCH requests travels as a one-time query param; the SPA reads it on
      // mount, stores it (see client/src/api.js), and strips it from the URL.
      const redirectUrl = new URL(env.CLIENT_ORIGIN);
      redirectUrl.searchParams.set('csrf', csrfToken);
      return res.redirect(redirectUrl.toString());
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export default createGoogleAuthRouter();
