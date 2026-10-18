# Google OAuth investigation

A full read of `server/src/routes/google-auth.routes.js`, `server/src/models/User.js`,
`server/src/routes/login.routes.js`, and their tests, plus the commit that introduced Google
sign-in (`f61ac46`). **One real bug was found and already fixed** in that same commit; no other
Google-related error exists in the current code. Nothing below is invented — every claim cites the
exact file/commit.

## What "Google sign-in" actually is here

Standard OAuth 2.0 authorization-code flow, hand-written against Google's endpoints directly (no
`passport` or similar dependency):

1. `GET /api/auth/google` — redirects the browser to `accounts.google.com`'s consent screen, with
   a random `state` value stored in a short-lived, path-scoped, httpOnly cookie (CSRF protection
   for the OAuth flow itself).
2. `GET /api/auth/google/callback` — Google redirects back with `?code&state`; the server verifies
   `state` matches the cookie, exchanges `code` for tokens at `oauth2.googleapis.com/token`, fetches
   the profile from `openidconnect.googleapis.com/v1/userinfo`, then finds-or-creates a `User` and
   issues the same session cookie (`sid`) that password login uses.

## The bug that was found and fixed (commit `f61ac46`)

**Root cause:** Before this commit, `User.passwordHash` was `required: true` unconditionally, and
`POST /api/auth/login` called `bcrypt.compare(password, user.passwordHash)` without checking that
`user.passwordHash` existed first.

**Evidence** (from the commit diff, `server/src/routes/login.routes.js`):
```diff
- if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
+ if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
```

**Why this was a real crash risk:** once Google-only accounts became possible (no password set),
any attempt to log in to one of those accounts with the password form would call
`bcrypt.compare(password, undefined)`. bcrypt throws on a non-string hash input — that's an
uncaught exception inside a route handler, which (depending on error-handling coverage elsewhere)
risks a 500 instead of the correct, clean `401 invalid_credentials` every other failed login
returns.

**The fix, as actually shipped:**
1. `login.routes.js` — short-circuits on a missing `passwordHash` before calling `bcrypt.compare`
   at all (diff above).
2. `models/User.js` — `passwordHash` changed from unconditionally `required: true` to
   conditionally required via a function (`required: unless this.googleId is set`), with a
   `googleId` field added (`select: false`, `sparse: true`, `unique: true` — sparse so multiple
   password-only users with no `googleId` don't collide on the unique index).
3. **A regression test was added** specifically for this case (per the commit message: "login
   regression" test, part of the 9 new tests in that commit).

**Current status: fixed and tested.** `npm test` was run fresh during this audit (2026-10-18):
```
# tests 106
# pass 106
# fail 0
```
This includes the Google OAuth happy path, account-linking, denied-consent, invalid-state,
token-exchange-failure, and the login regression test specifically. All passing is direct evidence
the fix works against the test suite's mocked Google responses — it is not, on its own, proof that
a *live* Google OAuth app behaves identically (see "Not yet verified" below).

## Other Google-related behavior in the code (by design, not bugs)

| Behavior | Where | Why it's correct, not a bug |
| --- | --- | --- |
| `GET /api/auth/google` returns `503 oauth_not_configured` | `google-auth.routes.js`, `googleConfigured()` check | Deliberate fail-closed default so the rest of the app works with zero Google setup — see `.env.example` |
| Google-verified emails are trusted (`emailVerified: true` set immediately) | callback handler | Google already verifies the email before issuing the token; re-verifying would be redundant |
| An existing password account with a matching email gets Google **linked**, not duplicated | callback handler | Prevents two separate accounts for the same person; the person can then log in either way |
| `?error=google_oauth_denied` / `google_oauth_invalid_state` / `google_oauth_failed` / `google_email_unverified` redirects | callback handler | Each failure mode redirects to the client with a specific error code instead of crashing or showing a raw error page |
| CSRF token delivered via one-time `?csrf=` query param after redirect | callback handler + `client/src/App.jsx` | A full-page redirect can't carry a JSON body the way a normal `fetch` login response can, so this is the documented workaround, consumed once and stripped from the URL by the client |

## Not yet verified (and why)

- **A real Google Cloud OAuth client has not been created or tested against live Google
  infrastructure in this session.** Doing so requires creating an OAuth client at
  [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
  under your own Google account — that step needs to be done by a human with access to that
  account; this audit cannot and should not create it on your behalf or enter your Google
  credentials anywhere.
- Once a real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL` are set and the
  server restarted, the way to verify the real flow end-to-end is manual: click "Continue with
  Google" on the login page and confirm it lands back on the client, signed in. The 106 passing
  tests mock Google's HTTP responses deliberately (so CI doesn't depend on a live Google app) and
  are not a substitute for that one manual check.
- **Common real-world misconfiguration to watch for**, even though none was observed in this
  code: `GOOGLE_CALLBACK_URL` must match the "Authorized redirect URI" on the Google Cloud OAuth
  client **exactly**, including protocol and trailing slash — the README's existing troubleshooting
  table already documents the resulting symptom (`?error=google_oauth_invalid_state`).

## Conclusion

The only Google-related defect found in the codebase was a login crash for OAuth-only accounts,
and it was already identified and fixed, with a regression test, in the same commit that added
Google sign-in (`f61ac46`). No other Google-related error exists in the current `main` branch as
of this audit.
