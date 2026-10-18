# Deployment & run runbook

Exact commands, verified against this repo at commit `f61ac46`. Commands marked **[verified]** were
actually run during this audit (2026-10-18) with the output shown or summarized; commands marked
**[from repo docs, not re-run]** come from the project's own existing `oss-onboarding/README.md` or
`oss-onboarding/docs/DEPLOYMENT.md` and are reproduced here for completeness, not re-tested in this
session.

## 1. Prerequisites

- Node.js ≥ 20 (`"engines": { "node": ">=20" }` in both `package.json` files)
- A reachable MongoDB — either Atlas (see [MONGODB_TEAM_ACCESS.md](./MONGODB_TEAM_ACCESS.md)) or
  local `mongod` on `127.0.0.1:27017`
- Ollama installed with `nomic-embed-text` and a chat model pulled (see
  [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md)) — only required for the AI features, not for auth/projects

## 2. Install — server **[verified]**

```bash
cd oss-onboarding/server
npm install
```
Ran clean in this session (`up to date`, no errors).

## 3. Environment setup

```bash
cp .env.example .env
```
Then fill in, at minimum, `MONGODB_URI` and `SESSION_SECRET` (`openssl rand -hex 32` for the
latter). Every variable is documented inline in `.env.example` and validated at startup by
`server/src/config/env.js` (Zod) — an invalid or missing required value prints exactly which
field is wrong and exits, rather than starting in a broken state.

## 4. Seed demo data **[verified]**

```bash
npm run seed
```
Output observed in this session: 3 users (contributor/maintainer/moderator), 2 test sessions,
3 projects (2 public verified, 1 private), 4 snapshots, 22 documents, 12 issues — idempotent (safe
to re-run).

## 5. Run the API **[verified via tests; dev server not started standalone in this pass]**

```bash
npm run dev     # nodemon src/index.js — http://localhost:5000/api/health
# or
npm start       # node src/index.js, no file-watching
```

## 6. Run tests **[verified]**

```bash
cd oss-onboarding/server
npm test
```
Actual output from this session:
```
# tests 106
# pass 106
# fail 0
# duration_ms ~10,500
```
Matches the README's claim exactly. These tests mock Mongoose and outbound HTTP (Ollama, Google) —
they run with no live MongoDB/Ollama/Google needed, by design (see `tests/seed.test.js`, which
explicitly mocks `mongoose.connect`).

## 7. Run and build the client **[from repo docs, not re-run this session — see FINAL_REPORT.md for a prior verified build]**

```bash
cd oss-onboarding/client
npm install
npm run dev      # http://localhost:5173 — vite proxies /api to :5000
npm run build    # production bundle to dist/
```

## 8. Populate issue embeddings for vector matching (optional) **[from repo docs]**

Needs Ollama running and the Atlas `issues_vector_index` created first (see
`server/src/config/vectorIndexes.js` for the index definition):
```bash
cd oss-onboarding/server
npm run embed-issues
```
Then set `ISSUE_VECTOR_SEARCH=true` in `.env` to switch matching from keyword to vector mode.

## 9. Production deployment **[from oss-onboarding/docs/DEPLOYMENT.md — authoritative, not duplicated here]**

The project already has a complete, specific deployment guide at
`oss-onboarding/docs/DEPLOYMENT.md` covering Render (API) + Render Static Site/Vercel (client) +
Atlas (DB), with exact environment variables and a post-deploy checklist. **That document is the
source of truth for deployment** — this runbook doesn't repeat it to avoid the two drifting apart.
The one point worth repeating here: **no production deployment exists yet** as of this audit (per
that doc's own "Deployment status: Not deployed" note) — if a live deployed URL is needed for the
mentor review, that work is still outstanding.

## 10. Common failures while running these commands

See [TROUBLESHOOTING_FAQ.md](./TROUBLESHOOTING_FAQ.md) for the full table; the fast version:

| Command | If it fails, most likely cause |
| --- | --- |
| `npm run dev` (server) | `.env` missing/invalid, or MongoDB unreachable |
| `npm test` | A code change broke a Zod schema or route contract — read the specific assertion that failed |
| `npm run dev` (client) | Server not running on :5000 (client proxies to it) |
| `npm run embed-issues` | Ollama not running, or the Atlas vector index doesn't exist yet |
