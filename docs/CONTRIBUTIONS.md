# Contribution report

Derived only from `git log`/`git log --numstat` on `main` (40 commits total, audited 2026-10-18).
Identities are merged where the same person used more than one name/email, matched against the
root README's ownership table. Names are shown exactly as the team's own README lists them.

**Excluded from this report, by explicit instruction:** commits authored as `Claude
<noreply@anthropic.com>` (6 commits — all branch-integration merges, no original code) and `Replit
Agent <agent@replit.com>` (1 commit — environment/report scaffolding). These were AI-assisted
repository operations, not a teammate's work, and are not counted toward anyone's contribution.
Likewise, commits made under the git identity `Ruchitra J <pixelforge3000@gmail.com>` are folded
into Swetha Jakka's totals below (same email as her other identities) and that name is not shown
separately.

## Identity merges applied

| Shown as | Roll no. | Git identities merged |
| --- | --- | --- |
| Swetha Jakka | 25071A0533 | `jakkaswetha2555 <jakkaswetha2555@gmail.com>`, `Swetha Jakka <pixelforge3000@gmail.com>`, and the `pixelforge3000@gmail.com` commit authored under the name "Ruchitra J" |
| bodanigayathri18 | 25071A0512 | `bodanigayathri18 <bodanigayathri18@gmail.com>` |
| lavanyachukkala19-design | 25071A0534 | `lavanyachukkala19-design@users.noreply.github.com` and `lavanyachukkala19@gmail.com` (same GitHub user, two emails) |
| P Nishith | 25071A0550 | `25071a0550@student.edu` |
| Sruthika | 25071A0566 | `usruthika2008@gmail.com` |
| V-Manaswi | 25071A0567 | `manaswi16v@gmail.com` |
| Gowthamvongoor | 25071A0569 | `gowthamvongoor@gmail.com` |
| Likith-1708 | 25071A0545 | `likithmygapula@gmail.com` |
| Raviteja2007-oo | 25071A0553 | `ravipullagurla123@gmail.com` |

## Confirmed contributions (non-merge commits, by roll number)

| Roll no. | Name | Module (per README) | Commits | Lines +/- | Files touched | What the commits actually show |
| --- | --- | --- | --- | --- | --- | --- |
| 25071A0533 | Swetha Jakka | Repo, integration, models, Zod schemas (lead) | 5 | +6,764 / -96 | 79 | Initial scaffold, README revisions, "complete remaining brief requirements" pass, and the most recent commit: Google OAuth + login-crash fix + dead-code removal (see [GOOGLE_OAUTH_INVESTIGATION.md](./GOOGLE_OAUTH_INVESTIGATION.md)) |
| 25071A0512 | bodanigayathri18 | Authentication | 7 | +389 / -72 | 6 | Signup, login (with session management), logout, current-user endpoint, session auth middleware — matches the owned module exactly |
| 25071A0534 | lavanyachukkala19-design | Project and issue APIs | 3 | +4,924 / -0 | 12 | Public/contributor project & issue routes, plus a large test/seed/evidence commit — the line count is high mainly because of added test fixtures and seed data, not all hand-written route logic |
| 25071A0550 | P Nishith | Seed data | 1 | +1,862 / -187 | 25 | Seed pipeline, 22 snapshot documents, tests, module technical report — matches the owned module |
| 25071A0566 | Sruthika | Ingestion | 1 | +49 / -0 | 2 | `services/ingestion/index.js` (embedding generation + document chunking) — matches the owned module; see the hardcoded-config finding in [ARCHITECTURE.md](./ARCHITECTURE.md#known-inconsistencies) |
| 25071A0567 | V-Manaswi | RAG and vector search | 5 | +1,114 / -57 | 13 | RAG/vector search service and routes, contributor-chat route logic, Replit environment config, `.mailmap`, a project-structure/docs update — matches the owned module |
| 25071A0569 | Gowthamvongoor | Onboarding agent | 1 | +1,919 / -2 | 14 | Onboarding agent tools — matches the owned module |
| 25071A0545 | Likith-1708 | Frontend A (`client/src` — auth, discovery) | 3 | +105 / -0 | 2 | Login and ProjectDiscovery components, in two follow-up "populate contents" fixes — matches the owned module |
| 25071A0553 | Raviteja2007-oo | Frontend B (`client/src` — issues, docs reader) | 2 | +323 / -131 | 4 | Issue browser and documentation reader components (same feature implemented twice across two commits) — matches the owned module |

## Not found in git history

- **25071A0523 — Security middleware, tests, evidence.** No commit in `main`'s history is
  authored by a distinct identity matching this module. The files that would belong to it
  (`server/src/middleware/*`, `docs/evidence/`) were in fact added by other commits: `errorHandler.js`
  came from the initial scaffold commit, `rateLimit.js` and part of `auth.js` came from Swetha
  Jakka's "complete remaining brief requirements" commit, and the rest of `auth.js` came from the
  25071A0534 and 25071A0569 commits. There is no `docs/evidence/` folder in the repository at all.
  **This is reported as-is, not guessed at** — per instructions, this report does not attribute
  that module's work to anyone without evidence.

## A caveat on using lines-of-code as a signal

Lines added/removed is included because it's objective and git-derived, but it is not a fair
single ranking: 25071A0534's and 25071A0550's high line counts are mostly generated seed/test
fixture data, not hand-authored logic, while 25071A0566's low count (49 lines) is a small,
self-contained, correctly-scoped module. Commit count and "does the work match the owned module"
are more informative here than raw line totals.
