# Deployment guide

This stack is three independently-deployable pieces:

| Piece | What it is | Where it can live |
| --- | --- | --- |
| **API** | Node/Express server (`server/`) | Render, Railway, Fly.io, a VPS — anywhere that runs a long-lived Node process |
| **Client** | Static React build (`client/` → `vite build` → `dist/`) | Render Static Site, Vercel, Netlify, Cloudflare Pages, or served by the API itself |
| **Database** | MongoDB | MongoDB Atlas (managed, recommended) |
| **AI inference** | Ollama (local LLM server) | See the "Ollama in production" section — this is the one genuinely hard part |

The recommendation below (Render + Render Static Site + Atlas) is chosen because all three have a
usable free tier, deploy straight from a GitHub repo with zero infra config, and the whole stack
can be stood up in under 15 minutes. Railway or Fly.io work identically for the API if preferred.

## 1. MongoDB Atlas

Already covered in the project's onboarding notes — summary:
1. Create a free (M0) cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Database Access → add a user with a strong password.
3. Network Access → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`) so the deployed API (whose outbound IP you don't control on a free tier) can reach it.
4. Connect → Drivers → copy the `mongodb+srv://...` URI, append a database name, e.g. `/oss_onboarding`.
5. If using semantic issue matching: create `chunks_vector_index` and `issues_vector_index` from `server/src/config/vectorIndexes.js` under Atlas Search.

## 2. API on Render

1. [render.com](https://render.com) → New → Web Service → connect this GitHub repo.
2. Root directory: `oss-onboarding/server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables (Render dashboard → Environment), matching `.env.example`:
   ```
   MONGODB_URI=<your Atlas connection string>
   SESSION_SECRET=<a long random string — openssl rand -hex 32>
   CLIENT_ORIGIN=https://<your-client-deployment-url>
   OLLAMA_URL=<see "Ollama in production" below>
   CHAT_MODEL=llama3.1:8b
   EMBED_MODEL=nomic-embed-text
   NODE_ENV=production
   REQUIRE_EMAIL_VERIFICATION=true
   SMTP_URL=<optional — a real SMTP URL if you want real verification/reset emails>
   GOOGLE_CLIENT_ID=<optional>
   GOOGLE_CLIENT_SECRET=<optional>
   GOOGLE_CALLBACK_URL=https://<your-api-deployment-url>/api/auth/google/callback
   ```
6. Deploy. Check `https://<your-api-url>/api/health` — `"database": "connected"` confirms Atlas is reachable.
7. If using Google sign-in: add the exact `GOOGLE_CALLBACK_URL` above as an **Authorized redirect URI** on the Google Cloud OAuth client, and add the client's deployed origin as an **Authorized JavaScript origin**.

## 3. Client on Render Static Site (or Vercel/Netlify)

1. New → Static Site → same repo, root directory `oss-onboarding/client`.
2. Build command: `npm install && npm run build`; publish directory: `dist`.
3. Add a rewrite/redirect so the API path isn't served by the SPA's catch-all route: proxy `/api/*` to the Render API service's URL (Render's "Redirects/Rewrites" tab), or simpler — set the client to call the API's full URL directly instead of a relative `/api` path (change `client/src/api.js`'s `fetch('/api${path}', ...)` to `fetch(\`${API_BASE}${path}\`)` reading `API_BASE` from a Vite env var, if the client and API end up on different domains).
4. Because the API and client will be on different origins in this topology, double-check cookies: the `sid` cookie is set with `sameSite: 'lax'`, which **works** for same-site navigation (the Google OAuth redirect) but a cross-origin `fetch` with `credentials: 'include'` for every other API call also needs `cors({ origin: CLIENT_ORIGIN, credentials: true })` on the API — already configured in `app.js`, just make sure `CLIENT_ORIGIN` exactly matches the deployed client URL (including `https://`, no trailing slash).

## 4. Ollama in production — the real caveat

Ollama is a *local* inference server: `OLLAMA_URL` must be an HTTP endpoint the deployed API
container can reach. Your laptop's `localhost:11434` is not reachable from Render's network, so the
AI endpoints (`/api/onboarding-agent`, `/api/contributor-chat`, embeddings on import) will return
"Ollama unavailable" errors against a plain Render deployment unless you do one of:

- **Self-hosted Ollama on a small cloud VM** (recommended for anything beyond a one-off demo): a
  $5–6/mo VPS (DigitalOcean, Hetzner, a cloud free-tier VM) with Ollama installed, `ollama pull
  nomic-embed-text` and `ollama pull llama3.1:8b` (or a smaller model if the VM is low-RAM), Ollama
  bound to `0.0.0.0:11434`, and the VM's firewall restricted to the Render API's outbound IP range
  if possible. Set `OLLAMA_URL=http://<vm-ip>:11434`. Put it behind HTTPS (a Caddy/nginx reverse
  proxy with a free Let's Encrypt cert) if the traffic needs to be encrypted.
- **Temporary tunnel for a live demo only**: run Ollama on your own machine, expose it with a
  tunnel (`ngrok http 11434` or a Cloudflare Tunnel), set `OLLAMA_URL` to the tunnel's HTTPS URL for
  the duration of the demo. Not durable — the tunnel dies when your laptop sleeps or the process
  stops — but it's the fastest way to show the AI features working against a real deployed API
  without paying for a VM.
- **Swap the provider**: `src/services/rag` and `src/services/agent` talk to Ollama through
  `@langchain/ollama`. Swapping to a hosted, OpenAI-compatible endpoint (including one that serves
  the same open models) is a same-shape change to those two files' client construction — out of
  scope here since it changes which AI provider the project depends on, but worth knowing it's a
  contained change if a hosted inference budget becomes available.

Either way, **tell whoever evaluates the deployed app** which of these you used — "Ollama runs on
a VPS at `<url>`" or "Ollama runs locally and is tunneled during the demo window" — so a 503 outside
that window is understood, not mistaken for a broken deployment.

## 5. Post-deploy checklist

- [ ] `GET /api/health` → `{"status":"ok","database":"connected"}`
- [ ] Sign up a test account, confirm the verification email is logged (or delivered, if `SMTP_URL` is set)
- [ ] Log in, confirm the `sid` cookie is set and `/api/me` returns the user
- [ ] If Google OAuth is configured: click "Continue with Google" end-to-end, confirm it lands back on the client logged in
- [ ] Run `npm run seed` once against the production `MONGODB_URI` if you want the demo projects/issues present (or skip it and let the first maintainer import a real snapshot via `POST /api/projects/:id/imports`)
- [ ] Hit `/api/onboarding-agent` or `/api/contributor-chat` as a signed-in user and confirm it's not returning "Ollama unavailable" (if it is, see §4)
