# Product guide — Open Source Contributor Onboarding

Written for someone with no prior context: a mentor, evaluator, or a new teammate.

## The problem

New contributors to an open-source project usually hit the same wall: they don't know which
issue is actually suited to their skill level, they can't easily ask questions about a codebase
without reading everything first, and maintainers get a flood of low-quality or duplicate
contribution attempts because nobody checked the basics (is this issue already claimed? does the
contributor's plan make sense?) before work started.

This project — **"Project 12: Open Source Contributor Onboarding"** — is a capstone that builds a
small platform to fix that specific handoff: matching a contributor to a suitable issue, letting
them ask grounded questions about the project's own documentation, and giving maintainers a review
step before code gets written.

## Who it's for

- **Contributors** — people who want to start contributing to an open-source project but don't
  know where to begin.
- **Maintainers** — people who own a project listed on the platform and need to vet incoming
  contribution plans and import their own documentation for the AI assistant to use.
- **Moderators** — verify that a maintainer-submitted project is legitimate before it goes public
  (`PATCH /api/projects/:id/verification`).

## What it does (use cases)

1. **Discover a project and matching issues.** A contributor browses public, verified projects
   (`GET /api/projects`) and gets issue matches scored against their stated skills and interests
   (`POST /api/issue-matches`) — with the reasons for the match, not just a score.
2. **Ask the documentation, not a search engine.** `POST /api/contributor-chat` answers a question
   using only a specific, versioned snapshot of the project's own docs (retrieval-augmented
   generation), citing which file(s) it used — or says `"Not found in snapshot."` rather than
   inventing an answer.
3. **Get a read-only starter-task suggestion.** `POST /api/onboarding-agent` runs a small
   tool-using AI agent that can look up open issues, check their prerequisites, and confirm an
   issue is still available — every tool call is logged (`agentRuns`), and the agent cannot write
   anything to the database itself.
4. **Submit and review a contribution plan.** A contributor submits a plan with evidence from the
   snapshot (`POST /api/contribution-plans`); the project's maintainer reviews it from an inbox
   (`GET /api/review-inbox`) and approves or requests changes.
5. **Sign in however is convenient.** Email/password (with rate-limited login, email verification)
   or "Continue with Google" — both land in the same session system.

## Why this approach (benefits)

- **Citations, not hallucination.** Every AI-generated answer the contributor sees is grounded in
  an actual document chunk from a specific snapshot version; if nothing supports an answer, the
  system says so instead of guessing.
- **A human maintainer still decides.** The AI agent is read-only and only *proposes*; approval,
  review, and project verification are all human actions.
- **Auditable by design.** Every onboarding-agent tool call is logged with its result, and the
  code that calls Ollama sanitizes anything that looks like a secret before logging it.
- **Fails safely.** Features that need optional setup (Google sign-in, Atlas vector search) check
  their own configuration and return a clean error instead of crashing the whole server when
  unset — see [ARCHITECTURE.md](./ARCHITECTURE.md) for where.

## Glossary

| Term | Meaning in this project |
| --- | --- |
| **Snapshot** | A versioned, frozen copy of a project's documentation (e.g. `v1.4.0`) that chat answers are grounded in — so an answer is reproducible even if the real docs change later. |
| **Chunk** | A snapshot document split into ~500-word pieces (50-word overlap) with an embedding vector, the unit that semantic search actually retrieves. |
| **Embedding** | A 768-number vector representation of a piece of text, produced locally by Ollama's `nomic-embed-text` model, used to find semantically similar text. |
| **RAG (Retrieval-Augmented Generation)** | Answering a question by first retrieving relevant chunks (via vector search), then asking the language model to answer *using only those chunks*. |
| **Vector search** | A MongoDB Atlas feature (`$vectorSearch`) that finds the chunks/issues whose embeddings are closest to a query's embedding. |
| **Maintainer grant** | The record that a specific user is allowed to act as maintainer for a specific project; starts `pending` and becomes `active` once a moderator verifies the project. |
| **Contribution plan** | What a contributor submits before writing code: a proposed approach plus evidence drawn from the snapshot, reviewed by the maintainer. |
| **Onboarding agent** | The read-only AI tool-user that suggests a starter issue; distinct from the RAG chat (which answers questions, not suggests tasks). |
| **CSRF token** | A one-time token the client must send on every write (`X-CSRF-Token` header) in addition to the session cookie, to stop cross-site request forgery. |
| **Ollama** | The local server (`localhost:11434` by default) that runs the open-weight language and embedding models this project depends on — no data leaves the machine running it unless it's deployed elsewhere. |

## Features at a glance

- Session-based auth (email/password + Google OAuth), email verification, password reset, rate
  limiting on login/signup.
- Project directory with public/private visibility and maintainer verification workflow.
- Issue browser with skill/interest-based matching (keyword fallback, optional Atlas vector mode).
- Grounded documentation Q&A with citations and a versioned snapshot system.
- Read-only onboarding agent with logged tool calls.
- Contribution plan submission + maintainer review inbox.
- CSRF-protected API, Helmet security headers, per-route rate limiting.

## Known limitations (as of this audit)

- **Atlas Vector Search for issue matching is off by default** (`ISSUE_VECTOR_SEARCH=false`) and
  needs the Atlas indexes created and `npm run embed-issues` run first; until then, matching uses
  a keyword/skill-overlap fallback (this is intentional, documented behavior, not a bug — see
  [ARCHITECTURE.md](./ARCHITECTURE.md)).
- **Ollama is a local/self-hosted dependency.** A cloud deployment of the API cannot reach a
  laptop's `localhost:11434`; see [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md) and
  `oss-onboarding/docs/DEPLOYMENT.md` §4 for the real options.
- **No production deployment exists yet** — this is a local/dev-verified build (see
  [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)).
- **One listed module (25071A0523 — security middleware, tests, evidence) has no attributable
  commits in git history** — see [CONTRIBUTIONS.md](./CONTRIBUTIONS.md).
- **The document-chunking service hardcodes its Ollama URL/model** instead of reading them from
  the shared `.env` config the rest of the app uses — see the finding in
  [ARCHITECTURE.md](./ARCHITECTURE.md#known-inconsistencies).

## Setup, usage and access

See [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for exact commands. In short: clone the repo,
install Ollama and pull two models, set up `server/.env` (MongoDB URI + a session secret), run
`npm run seed` then `npm run dev` in `server/`, and `npm run dev` in `client/` — the app is then at
`http://localhost:5173`, with demo accounts listed in the root README.
