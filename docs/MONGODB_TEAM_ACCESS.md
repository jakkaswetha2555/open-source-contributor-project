# MongoDB team access guide

This documents the team's **actual, already-existing** MongoDB Atlas setup — confirmed directly
from a screenshot of the Atlas dashboard during this audit (2026-10-18), not created or guessed.
**No credentials, connection strings, or passwords are reproduced here.**

## What already exists (verified)

- **Organization:** "Gayathri's Org" on MongoDB Atlas (`cloud.mongodb.com`).
- **Project:** "Project 0".
- **Network Access → IP Access List** already contains entries for the current browser's IP plus
  named entries for teammates: `Ravi-53`, `Nichitha-50`, `U.Sruthika-66`, `J.Swetha-33`,
  `Manaswi-67`, `Likith-45`, `Shrihan Kaushik-23`, `V.Gowtham-69`, and one entry marked "Created as
  part of the Auto Setup process". Most were added "6 days" before this audit.
- Atlas enforces this allowlist: **"You will only be able to connect to your cluster from the
  following list of IP Addresses"** — anyone not on the list is refused at the network level,
  regardless of whether they have valid database credentials.

What was **not** checked in this session (no screenshot/evidence available): Database Access
(which database users/roles exist), the actual cluster tier/region, and whether backups are
enabled. See "What to check yourself" below.

## How a teammate gets access

1. **They need an Atlas account** under the same organization ("Gayathri's Org") — the
   organization owner (or a user-management admin) invites them by email from
   **Organization → Access Manager → Invite to Organization**, or adds them directly to "Project 0"
   if they already have an Atlas account.
2. **Their IP must be allowlisted.** Each person's home/college/hostel network IP changes
   (dynamic IPs are normal on home broadband and mobile hotspots), so a teammate whose connection
   stops working is very often simply an IP that changed. Fix:
   - Go to **Database & Network Access → Network Access → IP Access List → Add IP Address**.
   - Click **"Add Current IP Address"** if they're doing it themselves from their own machine, or
     paste the exact IP they send you with a comment identifying them (matching the existing
     `Name-RollNumberLast2` convention already used, e.g. `Priya-12`).
   - Atlas supports `/32` single IPs (what's used here) or CIDR ranges; avoid `0.0.0.0/0` ("allow
     from anywhere") for a credentialed shared cluster — it defeats the point of an allowlist.
3. **They need a database user** (separate from their Atlas login) to actually authenticate the
   driver connection — **Database Access → Add New Database User**. Give each person their own
   user rather than sharing one, so access can be revoked individually later; scope the role to
   `readWrite` on the `oss_onboarding` database only, not an admin role.
4. **They need the connection string**, with their own username/password substituted in — get it
   from **Database → Connect → Drivers** in Atlas, not by copying someone else's `.env`. It looks
   like `mongodb+srv://<user>:<password>@<cluster-host>/oss_onboarding?retryWrites=true&w=majority`
   — **never commit this to git**; it goes in each person's own local `server/.env`
   (`MONGODB_URI=...`), which is already `.gitignore`d.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `MongooseServerSelectionError` / connection times out after ~10s | Your current IP isn't on the Atlas allowlist (most common cause — IPs change) | Atlas → Network Access → Add IP Address → Add Current IP |
| `Authentication failed` | Wrong username/password in `MONGODB_URI`, or a database user that doesn't exist/was revoked | Atlas → Database Access → confirm the user exists and reset its password if unsure |
| Works for you, fails for a teammate | Their IP isn't allowlisted yet, or they're using your `.env` (which has your credentials but your IP won't match theirs anyway) | Get their current IP (`curl ifconfig.me` or "what's my ip"), add it with a name, have them create/use their own database user |
| `GET /api/health` returns `"database": "disconnected"` | Same causes as above, surfaced by the app itself — this endpoint checks the live Mongoose connection state | Check the server logs for the actual Mongoose error, then apply the fixes above |
| Someone's IP changes daily (mobile hotspot, some home ISPs) | Dynamic IP | Either re-add their IP each session, or (team decision, lowers security) allow a broader range for that person only |

## What to check yourself (not verified in this audit)

- **Database Access tab** — confirm each teammate has their own database user, not a shared one,
  and that roles are scoped to `readWrite` on `oss_onboarding` rather than an Atlas admin role.
- **Cluster tier** — if this is the free M0 tier, note its limits (512MB storage, shared RAM) are
  fine for this project's demo data (seed creates 3 projects, 12 issues, 22 documents) but not for
  a real production load.
- **Backups** — M0 free clusters do not get continuous backups by default; if the demo data matters
  for the mentor review, keep `npm run seed` handy to idempotently restore it rather than relying on
  Atlas backups.
- **Who has organization-owner access** vs. just project access — worth confirming before the
  final submission so access doesn't bottleneck on one person being available.

## Local-only alternative (for solo development)

Anyone can also run MongoDB entirely locally instead of touching the shared Atlas cluster —
`MONGODB_URI=mongodb://127.0.0.1:27017/oss_onboarding` in their own `.env`, no network access list,
no shared credentials, nothing to coordinate. This is what was set up earlier in this session on
the lead's own machine for local development. The tradeoff: local data isn't shared with
teammates, and `ISSUE_VECTOR_SEARCH`/RAG document chat need Atlas specifically (`$vectorSearch` is
an Atlas-only aggregation stage, not available on a plain local `mongod`).
