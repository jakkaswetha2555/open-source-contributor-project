# Open Source Contributor Onboarding (Project 12)

AI-powered full stack capstone. Contributors discover suitable open source issues, ask questions about a
documentation snapshot (RAG with citations), and submit a contribution plan. Maintainers review plans.
A read-only onboarding agent proposes a starter task. Team lead: Swetha Jakka.

**Stack:** React (Vite), Node.js, Express, Mongoose, MongoDB Atlas + Vector Search, Ollama, LangChain JS, Zod.

## Quick start

```bash
git clone <repo-url> && cd oss-onboarding/server
npm install
cp .env.example .env        # fill in MONGODB_URI and SESSION_SECRET (ask the lead; never commit .env)
npm run dev                 # http://localhost:5000/api/health
npm test                    # model + schema tests
```

AI members: install Ollama, then `ollama pull nomic-embed-text` and `ollama pull llama3.1:8b`
(use `llama3.2:3b` on low-RAM laptops and set `CHAT_MODEL` in your `.env`).

## How the team works

- **One owner per folder.** Routes: add your own `server/src/routes/<name>.routes.js` exporting a default
  Router with FULL paths (e.g. `router.get('/projects', ...)`). It is auto-mounted under `/api`. Never edit `routes/index.js`.
- **Branches:** `feat/<area>-<last4 of roll>`. Open a pull request into `main`; the lead merges.
- **Every PR needs proof** (curl output, screenshot or recording). See the PR template.
- **Use the shared pieces:** enums in `server/src/constants.js`, models in `server/src/models`,
  request validators in `server/src/schemas`. Validate every request body with Zod.
- **Never commit secrets.** `.env` is git-ignored.

## Ownership

| Roll number | Module | Folder |
| --- | --- | --- |
| 25071A0533 (Swetha Jakka, lead) | Repo, integration, models, Zod schemas | repo root, `server/src/models`, `server/src/schemas`, `server/src/config` |
| 25071A0512 | Authentication | `server/src/routes/auth.routes.js` |
| 25071A0534 | Project and issue APIs | `server/src/routes/projects.routes.js`, `issues.routes.js` |
| 25071A0550 | Seed data | `server/src/seed`, `data/snapshots` |
| 25071A0566 | Ingestion | `server/src/services/ingestion` |
| 25071A0567 | RAG and vector search | `server/src/services/rag` |
| 25071A0569 | Onboarding agent | `server/src/services/agent` |
| 25071A0545 | Frontend A | `client/src` (auth, discovery) |
| 25071A0553 | Frontend B | `client/src` (issues, docs reader) |
| 25071A0523 | Security middleware, tests, evidence | `server/src/middleware`, `docs/evidence` |

## Collections

users, sessions, projects, maintainerGrants, snapshots, documents, chunks, issues, interests,
contributionPlans, reviews, agentRuns.

---

## Run it (server + client)

```bash
# 1. API
cd server
npm install
cp .env.example .env          # set MONGODB_URI and SESSION_SECRET
npm run seed                  # demo users, 3 projects, issues, snapshot docs
npm run dev                   # http://localhost:5000/api/health

# 2. Web app (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :5000)
```

Demo accounts (password `Password123!` for all): `contributor@student.edu`, `maintainer@project.org`, `moderator@portal.org`. Change these before any real deployment.
Verification and reset emails are printed in the server log unless `SMTP_URL` is set.
Set `REQUIRE_EMAIL_VERIFICATION=true` to block login until the email is verified (default for production).

### Google sign-in (optional)
"Continue with Google" on the login/signup pages works once you set three env vars; until then the
button exists but the server replies `503 oauth_not_configured`, so nothing else breaks.
1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create Credentials → OAuth client ID** → Application type **Web application**.
2. **Authorized redirect URI**: `http://localhost:5000/api/auth/google/callback` for local dev, or `https://<your-api-domain>/api/auth/google/callback` in production — it must match `GOOGLE_CALLBACK_URL` exactly.
3. Copy the Client ID and Client Secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   ```
4. Restart the server. A first-time Google sign-in creates a `contributor` account with `emailVerified: true`
   (Google already verified it). If the email matches an existing password account, Google is linked to it
   instead of creating a duplicate — that person can then log in either way.

### Atlas Vector Search (optional, for semantic matching)
1. Create the indexes from `server/src/config/vectorIndexes.js` in Atlas (`chunks_vector_index`, `issues_vector_index`).
2. Start Ollama and pull `nomic-embed-text`, then run `npm run embed-issues` in `server/`.
3. Set `ISSUE_VECTOR_SEARCH=true`. Without it, matching uses skill/keyword overlap and says so in the response (`method`).

## API reference

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/projects`, `GET /api/projects/:id/issues` | Public | Verified public projects only |
| `POST /api/auth/signup`, `/login`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/verify-email` | Public | Login limited to 5 failures / 15 min per account, signup 10/hour per IP |
| `GET /api/auth/google`, `GET /api/auth/google/callback` | Public | "Sign in with Google"; `503` if `GOOGLE_CLIENT_ID`/`SECRET`/`CALLBACK_URL` are unset |
| `GET /api/me`, `GET /api/auth/me`; `PATCH /api/me/profile` | Signed in | Skill profile used for matching |
| `POST /api/issue-matches` | Signed in | Open, unassigned issues with reasons; only projects the user may see |
| `POST /api/contribution-plans`, `GET /api/contribution-plans/:id`, `GET /api/my-plans` | Contributor (own plans) | Evidence from the snapshot is required |
| `POST /api/issues/:id/interest`, `PATCH /api/issues/:id`, `GET /api/issues/:id` | Contributor / maintainer | |
| `POST /api/projects/:id/imports` | Maintainer of the project | Chunks and embeds documents |
| `GET /api/review-inbox`, `POST /api/contribution-plans/:id/review` | Maintainer of the project | |
| `POST /api/contributor-chat` | Signed in | Cited answers with snapshot version, or "Not found in snapshot." |
| `POST /api/onboarding-agent` | Signed in | Read-only tools; every call logged in `agentRuns` |
| `PATCH /api/projects/:id/verification` | Moderator | Verifying a project activates its pending maintainer grants |

Browser sessions use an httpOnly `sid` cookie; every write must also send the `X-CSRF-Token` header (the web client does this automatically from the token returned at login).

## Tests

```bash
cd server && npm test      # 106 tests: models, schemas, every route (incl. Google OAuth), rate limits, moderation, matching, RAG, agent
cd client && npm run build
```

Server tests mock Mongoose model calls and outbound HTTP (Ollama, Google) with Node's built-in
`node:test` mocking — they run without a live MongoDB, Ollama, or Google app, and that's intentional
(fast, no external dependency in CI). They do **not** replace testing against a real `mongod` + Ollama
before you demo or deploy — see **Troubleshooting** below for how to do that locally.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Server exits immediately printing "Invalid environment configuration" | `.env` is missing or a required var (`MONGODB_URI`, `SESSION_SECRET`) is unset/too short. Copy `.env.example` again. |
| `npm run dev` hangs, then MongoDB connection errors after ~10s | No `mongod` reachable at `MONGODB_URI`. Start MongoDB locally (`mongod` service, or `mongosh` to check it's listening on `127.0.0.1:27017`) or point `MONGODB_URI` at an Atlas cluster you've whitelisted your IP for. |
| `GET /api/health` returns `"database": "disconnected"` | Same as above — the server is up but MongoDB isn't. This endpoint checks the real live connection state, not a hardcoded value. |
| Onboarding agent / contributor-chat endpoints return a 5xx with "Ollama unavailable" | Ollama isn't running, or the model isn't pulled. `ollama serve` in one terminal, `ollama list` in another to confirm `CHAT_MODEL` and `EMBED_MODEL` (from `.env`) are present. |
| `/api/auth/google` returns `503 oauth_not_configured` | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` are unset — see the Google sign-in section above. |
| Google sign-in redirects back with `?error=google_oauth_invalid_state` | The `oauth_state` cookie didn't round-trip — usually means `GOOGLE_CALLBACK_URL` doesn't match the Google Console redirect URI exactly, or the browser blocked the cookie (check you're on `http://localhost`, not `127.0.0.1`, consistently). |
| Every `POST`/`PATCH` from the web client returns `403 csrf_error` | The client lost its CSRF token (e.g. `sessionStorage` cleared, or a direct page reload after an OAuth redirect before the app read `?csrf=`). Log out and back in. |
| `npm test` fails on a `passwordHash` validation error you didn't expect | A test or seed script is creating a `User` without either `passwordHash` or `googleId` — every user needs one or the other. |
