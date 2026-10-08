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
