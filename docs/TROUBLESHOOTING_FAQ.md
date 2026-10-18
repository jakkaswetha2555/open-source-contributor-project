# Troubleshooting FAQ

Consolidated from the root README's existing troubleshooting table plus findings from this audit.
Marked with the doc that has more detail where relevant.

## Server won't start

**"Invalid environment configuration" then exits** — `server/.env` is missing or a required var
(`MONGODB_URI`, `SESSION_SECRET`) is unset, empty, or too short. Copy `.env.example` again and fill
both in.

**Hangs, then MongoDB connection errors after ~10s** — nothing is reachable at `MONGODB_URI`.
Either start local MongoDB (`mongod`), or if using Atlas, your IP likely isn't allowlisted — see
[MONGODB_TEAM_ACCESS.md](./MONGODB_TEAM_ACCESS.md).

## Database

**`GET /api/health` returns `"database": "disconnected"`** — the server is up but Mongoose isn't
connected to MongoDB. Same causes/fixes as above; this endpoint reflects the real live connection
state, not a cached or hardcoded value.

**`npm test` fails on a `passwordHash` validation error you didn't expect** — a test or seed script
created a `User` with neither `passwordHash` nor `googleId` set; every user needs one or the other
(see [GOOGLE_OAUTH_INVESTIGATION.md](./GOOGLE_OAUTH_INVESTIGATION.md) for why).

## Ollama / AI features

**Onboarding agent or contributor-chat return a 5xx "Ollama unavailable"** — Ollama isn't running,
or the configured model isn't pulled. See [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md) §5 for three ways
to verify it's actually connected.

**Responses are extremely slow** — the chat model is too large for available RAM. Switch to
`llama3.2:3b` (set `CHAT_MODEL` in `.env`).

**Document chat always says "Not found in snapshot."** — either no chunks have been embedded yet
for that project/snapshot (maintainer needs to import documents first,
`POST /api/projects/:id/imports`), or the Atlas `chunks_vector_index` hasn't been created (vector
search literally returns nothing without it — see `server/src/config/vectorIndexes.js`).

## Google sign-in

**`/api/auth/google` returns `503 oauth_not_configured`** — `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` are unset. This is deliberate, documented behavior,
not a bug — see the README's "Google sign-in" section for setup steps.

**Redirects back with `?error=google_oauth_invalid_state`** — almost always means
`GOOGLE_CALLBACK_URL` doesn't exactly match the "Authorized redirect URI" configured on the Google
Cloud OAuth client, or the browser blocked the state cookie (stay on `http://localhost` consistently,
not a mix of `localhost` and `127.0.0.1`).

## Client / session

**Every `POST`/`PATCH` from the web client returns `403 csrf_error`** — the client lost its CSRF
token (e.g. `sessionStorage` was cleared, or the page reloaded right after an OAuth redirect before
the app read `?csrf=`). Log out and back in.

**Client loads but API calls 404 or fail to connect** — the API server isn't running on `:5000`;
the Vite dev server proxies `/api/*` there, so the client alone isn't enough.

## MongoDB team access specifically

See [MONGODB_TEAM_ACCESS.md](./MONGODB_TEAM_ACCESS.md) for the full table — the short version:
almost every "it worked yesterday, not today" MongoDB issue in a team Atlas setup is a changed IP
address needing to be re-added to the Network Access allowlist.

## Tests

**A specific route test fails after a code change** — read the assertion message; the test suite
mocks Mongoose and outbound HTTP (Ollama, Google) deliberately, so a failure here reflects a real
contract break in route logic or validation, not a flaky external dependency.
