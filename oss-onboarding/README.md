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

### Atlas Vector Search (optional, for semantic matching)
1. Create the indexes from `server/src/config/vectorIndexes.js` in Atlas (`chunks_vector_index`, `issues_vector_index`).
2. Start Ollama and pull `nomic-embed-text`, then run `npm run embed-issues` in `server/`.
3. Set `ISSUE_VECTOR_SEARCH=true`. Without it, matching uses skill/keyword overlap and says so in the response (`method`).

## API reference

| Method and path | Access | Notes |
| --- | --- | --- |
| `GET /api/projects`, `GET /api/projects/:id/issues` | Public | Verified public projects only |
| `POST /api/auth/signup`, `/login`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/verify-email` | Public | Login limited to 5 failures / 15 min per account, signup 10/hour per IP |
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
cd server && npm test      # 97 tests: models, schemas, every route, rate limits, moderation, matching, RAG, agent
cd client && npm run build
```
