# Ollama guide

Ollama is the local server that runs the open-weight AI models this project depends on for
embeddings and chat — no API key, no per-request cost, nothing leaves the machine it runs on
(unless you deploy it elsewhere, see §6).

## 1. What this project actually uses it for

| Feature | File | Model used |
| --- | --- | --- |
| Document chat / RAG answers | `server/src/services/rag/ragService.js` | `CHAT_MODEL` (chat) + `EMBED_MODEL` (embeddings) |
| Document chunk embeddings on import | `server/src/services/rag/ingestionService.js`, `server/src/services/ingestion/index.js` | `EMBED_MODEL` (the latter hardcodes `nomic-embed-text` — see [ARCHITECTURE.md](./ARCHITECTURE.md#known-inconsistencies)) |
| Issue vector matching (optional) | `server/src/services/matching/index.js` | `EMBED_MODEL` |
| Onboarding agent | `server/src/services/agent/*` via `agentService.js` | model used for tool-calling/reasoning |

Two environment variables control which models are used — set in `server/.env`:

```
OLLAMA_URL=http://localhost:11434     # default; see §6 if Ollama runs elsewhere
CHAT_MODEL=llama3.1:8b                 # default in server/src/config/env.js
EMBED_MODEL=nomic-embed-text           # default; produces 768-dimension vectors
```

`EMBEDDING_DIMENSIONS = 768` is hardcoded in `server/src/constants.js` and must match whatever
embedding model is actually configured — `nomic-embed-text` is 768-dim, which is why it's the
default; swapping embedding models requires updating that constant too.

## 2. Installation

| OS | Command / link |
| --- | --- |
| Windows | Download and run the installer from [ollama.com/download](https://ollama.com/download) (a normal Windows installer — admin/UAC consent is required, same as any installer) |
| macOS | `brew install ollama`, or the `.dmg` from ollama.com/download |
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |

After installing, Ollama runs as a background service and listens on `127.0.0.1:11434`
automatically — there's no separate "start the server" step on Windows/macOS (the installer sets
it up as a service/menu-bar app). On Linux it may need `ollama serve` in a terminal if it wasn't
installed as a systemd service.

## 3. Pulling the models this project needs

```bash
ollama pull nomic-embed-text    # embeddings — ~274MB, works on any machine
ollama pull llama3.1:8b         # chat model — ~4.7GB, needs ~8GB+ RAM free
```

**Low-RAM laptops:** use a smaller chat model instead, and set `CHAT_MODEL` to match:

```bash
ollama pull llama3.2:3b         # ~2GB, works on 8GB RAM machines
```
```
# server/.env
CHAT_MODEL=llama3.2:3b
```

Confirm what's actually pulled:

```bash
ollama list
```

## 4. Hardware requirements (general guidance, not project-specific benchmarks)

| Model | Approx. size on disk | Practical RAM needed | Notes |
| --- | --- | --- | --- |
| `nomic-embed-text` | ~274MB | ~1GB | Embeddings only, fast, low resource cost |
| `llama3.2:3b` | ~2GB | ~8GB total system RAM | Good default for laptops |
| `llama3.1:8b` | ~4.7GB | ~16GB total system RAM recommended | The project's config default; noticeably slower/tighter on 8GB machines |

A discrete GPU speeds up inference significantly but is not required — Ollama runs on CPU too,
just slower per response. These are general Ollama guidelines, not numbers measured against this
specific project's workload in this session.

## 5. Verifying Ollama is connected (three ways)

1. **Hit the API directly** — the most reliable check, works from anywhere that can reach the host:
   ```bash
   curl http://localhost:11434/api/version
   curl http://localhost:11434/api/tags      # lists every pulled model
   ```
   A JSON response means Ollama is running and reachable at that URL.
2. **Watch the API server's terminal** while using an AI feature (chat, onboarding agent, issue
   import) — `npm run dev` in `server/` prints connection errors there if Ollama isn't reachable;
   a clean response with no "Ollama unavailable" error in the HTTP response confirms it worked.
3. **System tray / menu bar icon** (Windows/macOS) — Ollama shows an icon while its background
   service is running; right-click → view logs for recent activity.

If `/api/version` fails: Ollama isn't installed, isn't running, or something else is using port
11434. `ollama list` failing with a connection error points at the same thing.

## 6. Ollama in production / cloud deployment

This is the one part of the stack that **cannot** simply be pointed at `localhost` once the API is
deployed to a cloud host — a deployed server cannot reach a laptop's `localhost:11434`. The
project's own `oss-onboarding/docs/DEPLOYMENT.md` §4 already covers this in detail with three real
options (self-hosted Ollama on a small VPS, a temporary tunnel for a live demo, or swapping to a
hosted OpenAI-compatible provider) — that doc is the source of truth for deployment; this guide
focuses on local dev and verification.

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `curl http://localhost:11434/api/version` → connection refused | Ollama isn't running | Reinstall/restart it; on Linux, `ollama serve` |
| AI endpoints return 5xx "Ollama unavailable" | Ollama not running, or `OLLAMA_URL` in `.env` doesn't match where it's actually listening | Verify with `curl $OLLAMA_URL/api/version` using the exact URL from `.env` |
| Chat/embedding calls are very slow | Chat model too large for available RAM, causing disk swapping | Switch to `llama3.2:3b` or smaller, set `CHAT_MODEL` to match |
| `ollama pull` hangs or fails | Network restriction, or disk space | Check free disk space (`llama3.1:8b` alone needs ~5GB); retry on a different network if a firewall blocks it |
| Embeddings come back the wrong length, RAG/matching throws a dimension error | `EMBED_MODEL` doesn't match `EMBEDDING_DIMENSIONS` (768) in `constants.js` | Use `nomic-embed-text` (768-dim) unless you also update that constant and every stored embedding |
| Port 11434 already in use | Another Ollama instance or an unrelated process | `lsof -i :11434` (macOS/Linux) or check Task Manager (Windows) for what's holding the port |
