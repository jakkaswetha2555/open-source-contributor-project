# /docs — audit & documentation index

This folder is a full audit of the **Open Source Contributor Onboarding** project (Team 12),
produced by inspecting the actual repository (code, commits, configs, existing docs) rather than
assuming what the project does. It sits alongside the project's own `oss-onboarding/docs/` folder
(DEPLOYMENT.md, FINAL_REPORT.md, architecture.md, etc.), which is left untouched — this is a
second, broader pass on top of it.

**Audited:** 2026-10-18, commit `f61ac46` on `main`.

| Doc | What it's for |
| --- | --- |
| [PRODUCT_GUIDE.md](./PRODUCT_GUIDE.md) | What the product is, for a beginner: problem, users, use cases, features, glossary, limitations |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How it's built: modules, data flow, integration map, verified/partial/broken status |
| [CONTRIBUTIONS.md](./CONTRIBUTIONS.md) | Who built what, derived only from git history |
| [MONGODB_TEAM_ACCESS.md](./MONGODB_TEAM_ACCESS.md) | The real Atlas cluster, how teammates get access, troubleshooting |
| [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md) | Installing, running, and connecting Ollama (the local AI model server) |
| [GOOGLE_OAUTH_INVESTIGATION.md](./GOOGLE_OAUTH_INVESTIGATION.md) | What Google-related issues actually existed, root cause, fix, evidence |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Exact, repo-verified commands to run and build everything, locally and in production |
| [TROUBLESHOOTING_FAQ.md](./TROUBLESHOOTING_FAQ.md) | Common failures and fixes, consolidated from the README and this audit |

## How to read "verified" in these docs

- **Verified** — I ran it myself in this session and saw the result (a command, a test suite, a
  screenshot), or it's unambiguous from reading the code.
- **Partial** — the code exists and looks complete, but a dependency it needs (an Atlas index, a
  pulled model, a deployed service) hasn't been turned on/created yet.
- **Planned** — mentioned in docs or env config as an option but no code path implements it yet.
- **Broken / inconsistent** — code exists but contradicts itself or the rest of the app (named
  specifically, with the file and line).
- **Not verified in this session** — plausible and backed by prior evidence (e.g. from earlier in
  this conversation) but not re-checked live while writing this doc.

Nothing here is a guess dressed up as a fact; where I couldn't check something, it says so.
