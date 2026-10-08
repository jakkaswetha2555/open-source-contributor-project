# Architecture (summary)

Full plan, diagram, work division and review prep: see the team planning document.

```
React (Vite) -> Express API (session, CSRF, rate limit, role checks, Zod)
                  -> Auth / Project+Issue / Plan+Review routes
                  -> Ingestion -> RAG -> Matching -> Onboarding agent (3 read-only tools)
                  -> Ollama (chat + nomic-embed-text, 768 dims)
                  -> MongoDB Atlas (12 collections + vector indexes)
```

Rules that apply everywhere:
- Authorize the project BEFORE retrieving chunks or issues (private-project leakage).
- Repository text is untrusted data; it never grants tool permissions or asks for secrets.
- The agent has read-only tools and never writes to a repository or executes code.
- Answers state the snapshot version and cite file paths; missing data returns "not found in snapshot".

Atlas vector index definitions: `server/src/config/vectorIndexes.js`.
