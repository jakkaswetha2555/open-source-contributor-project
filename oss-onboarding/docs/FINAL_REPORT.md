# Completion report — production-readiness pass

Date: 2026-10-18 · Branch: `feat/production-readiness-0533`

## What this pass found

The repo was already far more complete than a "make it functional" request usually implies — 9
team branches had already been merged into `main` across an earlier PR (#9), giving a real
Express + MongoDB + Ollama backend with session auth, rate limiting, RAG document Q&A, an
onboarding agent, issue matching, a moderation/review workflow, and a React client. This pass
audited that existing work rather than rebuilding it, and made targeted additions and fixes.

## Completed this pass

| Area | What was done |
| --- | --- |
| **Google OAuth** | New `GET /api/auth/google` + `/callback` (standard OAuth 2.0 authorization-code flow, no extra dependency). Creates a verified `contributor` on first sign-in, links to an existing email/password account if the email matches, reuses the same session mechanism as password login. Fails closed (`503`) if unconfigured instead of crashing the app. |
| **User model** | `passwordHash` is now optional (conditionally required unless `googleId` is set) — Google-only accounts are valid users; a user with neither is rejected by schema validation. |
| **Bug fix** | `POST /api/auth/login` would throw an uncaught error (`bcrypt.compare` on `undefined`) for a Google-only account instead of returning `401`. Fixed and covered by a regression test. |
| **Dead code removed** | `server/src/middleware/auth.middleware.js` — an unused duplicate of `middleware/auth.js`, imported by zero route files. |
| **Minor consistency fix** | `logout.routes.js` read `process.env.NODE_ENV` directly instead of the validated `env.NODE_ENV`. |
| **Client** | "Continue with Google" button on Login and Signup; `App.jsx` now consumes the one-time `?csrf=` token a full-page OAuth redirect carries back (a JSON response can't deliver it, unlike the regular login call), and shows `?error=` from a failed OAuth attempt. |
| **Config** | `.env.example` and the Zod env schema both document `GOOGLE_CLIENT_ID`/`SECRET`/`CALLBACK_URL`, all optional. |
| **Tests** | 9 new tests (Google OAuth redirect/callback happy path, account-linking, denied consent, invalid state, token-exchange failure, the login regression, the User-model auth-method rule) — **106/106 passing**, up from 97. |
| **Docs** | README: Google sign-in setup, updated API table, updated test count, a new Troubleshooting table. New `docs/DEPLOYMENT.md` (platform choice, step-by-step, and the Ollama-in-production caveat explained in full). New `docs/windows-diagnostic.ps1` for local environment verification (see below). |

## Test results (evidence, not a claim)

```
cd oss-onboarding/server && npm test
# tests 106
# pass 106
# fail 0
```
Also verified independently of the test runner: `node --check` on every `src/**/*.js` file (no
syntax errors), a real `createApp()` + `app.listen()` instance (not the test harness) hit over real
HTTP — `/api/health` → `200`, `/api/auth/google` → `302` to `accounts.google.com`, invalid signup
body → `422` — and `cd oss-onboarding/client && npm run build` → clean production build
(`dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`, no errors).

## What was genuinely NOT verified, and why — read this before assuming more was tested

I do not have a real MongoDB or a real Ollama reachable from either tool environment available to
me in this session, and I confirmed that directly rather than assuming it:

- **This cloud workspace**: tried pulling a MongoDB download, a Docker image, and resolving an
  arbitrary hostname — all blocked by the environment's network allowlist (confirmed via actual
  failed `curl`/`docker pull`/`dns.lookup` calls, not a guess).
- **The "Claude Desktop" device bridge**: despite appearing connected, running a command (`uname
  -a`) proved it executes in an isolated Linux sandbox, not your actual Windows laptop — no `C:\`
  drive, no real terminal access to your machine at all.

So: the 106 passing tests are real and are the correct way to test this kind of app (they mock the
two external services deliberately, which is why they run in milliseconds and don't need a live
database — that's good test design, not a shortcut). What they do **not** prove is that a real
`mongod` and a real `ollama serve` on your actual machine will behave the same way end to end.

**To close that gap**, run `oss-onboarding/docs/windows-diagnostic.ps1` in PowerShell on your
laptop and send me the output — it checks whether MongoDB/Ollama are installed, running, and which
ports are free, without changing anything. From there I can tell you exactly what to install or
start, and once a real `mongod` is reachable, `npm run dev` + `npm run seed` + the demo accounts
(see README) give you a real, fully local end-to-end run to verify by hand or screen-record for
submission evidence.

## Deployment status

**Not deployed** — no hosting account credentials were available to me, and deploying is something
you may want to review the destination for first (a free Render/Atlas account is enough, no cost,
but it's still your account to create). `docs/DEPLOYMENT.md` has exact, copy-paste steps for
Render (API) + Render Static Site or Vercel (client) + Atlas (DB), and spells out the one real
unsolved piece: Ollama is a local inference server, so a cloud-deployed API needs either a small
VPS running Ollama, a temporary tunnel from your machine for a live demo, or a swap to a hosted
inference provider — all three options are explained with trade-offs in that doc.

## Remaining blockers (things only you can do)

1. **Local verification** — run the PowerShell script above and share the output.
2. **Push/merge this branch** — pushed as `feat/production-readiness-0533`; see the PR for the diff. Merge it into `main` once you've looked it over (or ask me to walk through any part of it).
3. **Google Cloud OAuth app** — if you want "Continue with Google" live, you need to create the OAuth client yourself (needs your Google account) and paste the client ID/secret into `.env`; I can't create that for you.
4. **Deployment account** — pick and create a (free) Render/Atlas account when you're ready to deploy; I'll handle the configuration once you confirm which platform.
5. **Ollama in production** — decide which of the three options in `DEPLOYMENT.md` §4 fits your situation (VPS cost vs. demo-only tunnel vs. hosted provider) before the submission deadline, since this is the one piece that needs a decision, not just code.
