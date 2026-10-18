# Architecture, data flow, and integration map

Reconstructed from the actual code at commit `f61ac46` (`main`), not from a design doc — every
claim below points at a real file.

## System diagram

```
                        ┌─────────────────────────┐
                        │   React client (Vite)    │
                        │   client/src/*.jsx        │
                        │   :5173 (dev)             │
                        └────────────┬──────────────┘
                                     │ fetch('/api/...', {credentials:'include'})
                                     │ cookie: sid (httpOnly) + header: X-CSRF-Token
                                     ▼
                        ┌─────────────────────────┐
                        │  Express API  :5000       │
                        │  server/src/app.js         │
                        │  helmet, cors, cookieParser│
                        └────────────┬──────────────┘
                                     │ auto-mounted at /api
                                     │ server/src/routes/index.js
                 ┌───────────────────┼────────────────────────┐
                 ▼                   ▼                        ▼
      auth/login/logout/me   projects/issues/plans   agent / contributor-chat
      google-auth.routes.js  matching.routes.js       agent.routes.js
                 │                   │                        │
                 ▼                   ▼                        ▼
         ┌───────────────┐   ┌───────────────┐       ┌─────────────────┐
         │   MongoDB      │   │ services/      │       │ services/rag,    │
         │   (Mongoose)   │◄──┤ matching       │       │ services/agent    │
         │   Atlas        │   └───────┬───────┘       └─────────┬────────┘
         └───────┬───────┘           │                          │
                 │                   ▼                          ▼
                 │           ┌───────────────┐          ┌───────────────┐
                 │           │ Ollama         │◄─────────┤ Ollama         │
                 │           │ embeddings     │          │ chat + embed   │
                 │           │ :11434         │          │ :11434         │
                 │           └───────────────┘          └───────────────┘
                 │
                 └── services/ingestion (chunk + embed uploaded docs on import)

      External: accounts.google.com (OAuth) ── only from google-auth.routes.js
```

## Backend modules (server/src)

| Folder/file | Owns | Status |
| --- | --- | --- |
| `app.js`, `index.js` | Express app wiring, process entrypoint | **Verified** — starts, listens, real HTTP hit in a prior session (`/api/health` → 200) |
| `config/env.js` | Zod-validated environment config; the single source of truth for every setting | **Verified** |
| `config/db.js` | Mongoose connection | **Verified** |
| `config/vectorIndexes.js` | Definitions for the two Atlas Search indexes (not the indexes themselves — Atlas needs them created manually, see below) | **Partial** — definitions exist in code; whether they're created in Atlas wasn't checked in this session |
| `routes/index.js` | Auto-mounts every `*.routes.js` file in the folder under `/api` (no central router to merge-conflict over) | **Verified**, and a genuinely good pattern for a 10-person team repo |
| `routes/*.routes.js` (14 files) | One owner per route file, per the root README's ownership table | **Verified present**; see [CONTRIBUTIONS.md](./CONTRIBUTIONS.md) for who |
| `models/*.js` (12 Mongoose models) | `User, Session, Project, MaintainerGrant, Snapshot, Document, Chunk, Issue, Interest, ContributionPlan, Review, AgentRun` | **Verified** — all exported from `models/index.js`, used across routes |
| `schemas/*.js` | Zod request-body validators | **Verified** — used in routes before touching the DB |
| `middleware/auth.js` | Session + CSRF check, role gating | **Verified** |
| `middleware/rateLimit.js` | Per-route limits (login 5/15min per account, signup 10/hr per IP) | **Verified** — values match the README's claim |
| `middleware/errorHandler.js` | Central error + 404 handling | **Verified** |
| `services/rag/ragService.js` | Embeds a question, runs Atlas `$vectorSearch` on `chunks`, asks Ollama to answer *only* from the retrieved text, validates the model's JSON response against a strict Zod schema | **Verified** (code-complete, config-driven, well-guarded against the model inventing citations) |
| `services/rag/ingestionService.js` | Document ingestion for RAG (chunk + embed on maintainer import) | **Verified present**, not executed live in this session |
| `services/ingestion/index.js` | `generateEmbedding`, `splitIntoChunks` (500 words / 50 overlap) | **Broken / inconsistent** — see below |
| `services/matching/index.js` | Issue-to-contributor scoring; keyword/skill overlap by default, Atlas vector search if `ISSUE_VECTOR_SEARCH=true` and it fails, falls back to keyword and reports which `method` was used | **Verified** — correctly reads `env.OLLAMA_URL`/`env.EMBED_MODEL`, has a real fallback path |
| `services/agent/*` | Read-only onboarding agent: `findIssues`, `inspectPrerequisites`, `checkIssueAvailability`, orchestrated by `agentService.js`, which redacts anything matching `password/token/secret/authorization/cookie/key` before logging tool args | **Verified** — the redaction is real code, not a claim |
| `seed/seed.js` | Idempotent demo data: 3 users, 3 projects, 12 issues, 4 snapshots, 22 documents | **Verified** — ran it in this session, output matches |
| `scripts/embed-issues.js` | One-off script to populate issue embeddings for vector matching | **Verified present**, not run in this session (needs Ollama + Atlas reachable) |

### Known inconsistencies

- **`server/src/services/ingestion/index.js` hardcodes its Ollama connection**
  (`baseUrl: 'http://localhost:11434'`, `model: 'nomic-embed-text'`) instead of reading
  `env.OLLAMA_URL` / `env.EMBED_MODEL` from `config/env.js` the way `services/rag/ragService.js`
  and `services/matching/index.js` both correctly do. This works today because the default *is*
  `localhost:11434`, but it will silently ignore a custom `OLLAMA_URL` (e.g. a VPS-hosted Ollama in
  production, see [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md)) while every other AI-calling file respects
  it. **Fix:** import `env` from `../../config/env.js` and use `env.OLLAMA_URL` / `env.EMBED_MODEL`
  here too, for consistency with the rest of the codebase.

## Frontend (client/src)

| File | Role | Status |
| --- | --- | --- |
| `App.jsx` | Routing, reads the one-time `?csrf=` query param after an OAuth redirect, surfaces `?error=` | **Verified** |
| `api.js` | Single `api()` helper: sends the session cookie, attaches `X-CSRF-Token` from `sessionStorage` on writes | **Verified** |
| `Login.jsx`, `AuthPages.jsx` | Email/password + "Continue with Google" | **Verified** |
| `ProjectDiscovery.jsx` | Browse projects, request issue matches | **Verified present** |
| `IssueBrowser.jsx`, `DocsReader.jsx` | Issue list, documentation snapshot reader/chat UI | **Verified present** |
| `StarterPlan.jsx` | Contribution plan submission | **Verified present** |
| `ReviewInbox.jsx` | Maintainer review UI | **Verified present** |

`npm run build` in `client/` was confirmed in a prior pass of this project (see
`oss-onboarding/docs/FINAL_REPORT.md`) to produce a clean production bundle.

## Data flow: a contributor question, end to end

1. Client calls `POST /api/contributor-chat` with a `question`, `projectId`, `snapshotId`.
2. `ragService.answerContributorQuestion` embeds the question via Ollama (`OllamaEmbeddings`,
   `EMBED_MODEL`, 768 dimensions — must match `EMBEDDING_DIMENSIONS` in `constants.js`).
3. The embedding is used in an Atlas `$vectorSearch` aggregation on the `chunks` collection,
   filtered to the right `projectId`, `snapshotId`, and visibility the requester is allowed to see.
4. If no chunks come back, the answer is the fixed string `"Not found in snapshot."` — no model
   call happens.
5. Otherwise, the retrieved chunks are sent to Ollama's chat model (`ChatOllama`, `CHAT_MODEL`)
   with an explicit instruction to answer *only* from the supplied evidence and to treat that
   evidence as untrusted data, not instructions (this is a real prompt-injection guard in the
   prompt text itself).
6. The model's JSON response is parsed and validated against a strict Zod schema
   (`found`, `answer`, `evidenceNumbers`); citations are built only from chunks the model actually
   cited, and if citation resolution comes up empty, the answer reverts to "Not found."

## Authentication and external services

| Service | Where | Required? | Fails-closed behavior |
| --- | --- | --- | --- |
| **MongoDB (Atlas)** | `config/db.js`, every model | Yes | Server exits at startup if `MONGODB_URI`/`SESSION_SECRET` are missing or invalid (Zod); `GET /api/health` reports live connection state, not a hardcoded value |
| **Ollama** (chat + embeddings) | `services/rag`, `services/matching`, `services/ingestion`, `services/agent` indirectly | Only for AI features | AI endpoints return an error ("Ollama unavailable") if unreachable; the rest of the app (auth, projects, plans) works without it |
| **Google OAuth 2.0** | `routes/google-auth.routes.js` | No — optional | `GET /api/auth/google` returns `503 oauth_not_configured` instead of crashing if the three env vars are unset — see [GOOGLE_OAUTH_INVESTIGATION.md](./GOOGLE_OAUTH_INVESTIGATION.md) |
| **SMTP** (email) | `services/account/mailer.js` | No — optional | Verification/reset emails are printed to the server log instead of sent, if `SMTP_URL` is unset |
| **Atlas Vector Search** | `services/rag`, `services/matching` | No — optional, off by default | Falls back to keyword matching; RAG chat still requires the `chunks_vector_index` to exist for document Q&A to return results at all (this one isn't optional for that specific feature) |

## Collections (12 models → MongoDB collections)

`users, sessions, projects, maintainerGrants, snapshots, documents, chunks, issues, interests,
contributionPlans, reviews, agentRuns` — matches the root README exactly; confirmed against
`models/index.js`.
