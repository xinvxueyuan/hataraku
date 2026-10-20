# Turnstile: the real key chain, verified

Recorded 2026-10-20. Until now only the "no captcha configured" branch had been exercised: `apps/server/.env`
deliberately carries no `TURNSTILE_SECRET_KEY` because the end-to-end stack loads that file, and a secret
there would force a captcha the suite cannot answer.

## How it was run

Both keys were passed as process environment variables, so no file changed and the e2e setup stays intact:

```powershell
# terminal 1 — API
$env:TURNSTILE_SECRET_KEY = "<secret>"
$env:PORT = "3301"
$env:BETTER_AUTH_URL = "http://localhost:3300"
node --env-file-if-exists=.env src/index.ts

# terminal 2 — web
$env:SERVER_URL = "http://localhost:3301"
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY = "<site key>"
npx next dev -p 3300
```

Ports 3300/3301 because this machine's 3000/3001 are held by `wslrelay`.

## Evidence

Client side: `GET /login` returned 200 and its HTML carries the loader
`challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, which `auth-form.tsx` only renders when
`turnstileSiteKey` is non-empty.

Server side, the decisive pair of requests:

| Request | Result | Reading |
| --- | --- | --- |
| `POST /api/auth/sign-in/email` with no token | **400, 1 ms**, `{"message":"Missing CAPTCHA response","code":"MISSING_RESPONSE"}` | Rejected locally and instantly — the plugin is registered and enforcing |
| `POST /api/auth/sign-in/email` from the browser with a real token | **401, 524 ms**, `WARN [Better Auth]: User not found` | The 524 ms is a round trip to Cloudflare's siteverify; the request only reached the user lookup because the captcha passed |

The timestamp is the evidence: a captcha failure returns in about a millisecond without leaving the process,
while a verification costs a network round trip. A 401 for a missing user is the expected outcome — the new
database holds migrated content and no accounts yet.

## What this does not cover

A token from a real browser was required; a headless browser cannot obtain one (Cloudflare answers error
110200 for automated clients). That is why this ran in a visible session instead of in the suite.
