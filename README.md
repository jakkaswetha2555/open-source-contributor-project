# Open Source Contributor Onboarding (TEAM 12)

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

## Full audit (2026-10-18)

A complete, evidence-based audit of this repo — product docs, architecture, a contribution report
from git history, a MongoDB team-access guide, an Ollama guide, a Google OAuth investigation, a
deployment runbook, and a troubleshooting FAQ — lives in **[`/docs`](./docs/README.md)**. It sits
alongside `oss-onboarding/docs/` (the module-level reports already there) rather than replacing it.

### Current progress

| Area | Status |
| --- | --- |
| Auth (email/password + Google OAuth) | **Done** — 106/106 tests passing, re-run during this audit |
| Project/issue browsing, maintainer verification | **Done** |
| Contribution plans + maintainer review inbox | **Done** |
| Documentation RAG chat with citations | **Done** (code-complete; needs the Atlas `chunks_vector_index` created to return results) |
| Onboarding agent (read-only, logged tool calls) | **Done** |
| Issue matching | **Done** — keyword/skill fallback always on; Atlas vector mode is built but off by default (`ISSUE_VECTOR_SEARCH=false`) until `npm run embed-issues` is run |
| Client (React/Vite) | **Done** — builds cleanly |
| Production deployment | **Not done** — see `oss-onboarding/docs/DEPLOYMENT.md` for the plan; no live URL yet |

### Integrations inventory

| Integration | Required? | Status |
| --- | --- | --- |
| MongoDB Atlas | Yes | **Live** — shared team cluster exists with teammates' IPs allowlisted; see [`docs/MONGODB_TEAM_ACCESS.md`](./docs/MONGODB_TEAM_ACCESS.md) |
| Ollama (chat + embeddings) | Only for AI features | Configured and used across `services/rag`, `services/matching`, `services/agent`; one module (`services/ingestion`) hardcodes its connection instead of reading `.env` — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#known-inconsistencies) |
| Google OAuth 2.0 | No — optional | Implemented, tested, fails closed (`503`) when unconfigured; investigation and the one bug it had (already fixed) in [`docs/GOOGLE_OAUTH_INVESTIGATION.md`](./docs/GOOGLE_OAUTH_INVESTIGATION.md) |
| SMTP | No — optional | Falls back to logging verification/reset emails to the console |

### Known issues

- `services/ingestion/index.js` hardcodes `localhost:11434` / `nomic-embed-text` instead of using
  `env.OLLAMA_URL` / `env.EMBED_MODEL` like the rest of the codebase — works today only because
  that happens to be the default.
- No commits in git history are attributable to the 25071A0523 module (security middleware, tests,
  evidence) — see the contribution report.
- No production deployment exists yet.

### Contribution summary

Full per-person breakdown (commits, lines, what each person's commits actually contain) is in
[`docs/CONTRIBUTIONS.md`](./docs/CONTRIBUTIONS.md), derived only from git log — nine teammates have
confirmed, module-matching commits; one listed module has none.

### Next steps

1. Decide and execute a deployment plan (`oss-onboarding/docs/DEPLOYMENT.md`) if a live URL is
   needed for submission/review.
2. Create the Atlas `chunks_vector_index` / `issues_vector_index` (definitions already in
   `server/src/config/vectorIndexes.js`) if semantic search is wanted for the review.
3. Fix the hardcoded Ollama config in `services/ingestion/index.js`.
4. Confirm Database Access roles on the shared Atlas cluster are per-person, not shared.
