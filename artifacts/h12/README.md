# H12 — 2FA enrolment in the browser

The enrolment page is `/settings/two-factor`. It is reachable from the account menu
("Two-factor authentication") while signed in, and `/login` carries it in `redirectTargets` so an
unauthenticated visit returns there after signing in.

## What the page does

| Step                      | Implementation                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Start enrolment           | `authClient.twoFactor.enable({ password })` — Better Auth requires the account password                    |
| Scan the code             | `react-qr-code@2.2.0` renders the server's `totpURI` as an SVG — the URI goes in as-is, never re-encoded      |
| Manual key fallback       | The base32 `secret` query parameter of that URI, shown in a selectable `<code>` with a copy button             |
| Backup codes              | All ten, in a two-column grid, with the one-time-use rule and a checkbox that gates verification                    |
| Finish                    | Six digit code → `twoFactor.verifyTotp` → success message; a rejected code prints the server's reason ("Invalid code") |
| Enrolled state            | Status card with the session's `twoFactorEnabled`; disabling needs the password inside a second confirmation panel  |

## The QR code is measured, not assumed

The previous stack shipped a broken QR: a value that was already a data URI got wrapped in
`encodeURIComponent` and a second data URI, so the image had `naturalWidth = 0`. This page passes
`totpURI` straight to `react-qr-code`, and `artifacts/h12/verify-two-factor.mjs` proves the result
in a real Chromium:

- the SVG's box is 192×192 CSS px (not 0),
- it contains the two `<path>` elements (background + foreground),
- the foreground path has > 1 200 `M` sub-paths (the dark modules),
- its `viewBox` is `0 0 49 49`, and the full path string equals the matrix rebuilt independently
  from the `totpURI` the enable response returned (`qrcode-generator` 2.0.4, the same generator
  `react-qr-code` calls).

All 23 checks pass against a real stack (Chromium + Next.js + Hono + PostgreSQL), including a real
sign-out / sign-in round trip with a TOTP computed from the displayed manual key, and a later
sign-in that no longer asks for a code after disabling. `verification.json` records every check and
the measured QR geometry; `screenshots/` holds the nine states.

## A sign-in bug this exercise uncovered

`AuthForm` switched to the second-factor card through Better Auth's `onTwoFactorRedirect`
callback, but the credential mutation's `onSuccess` still called `router.push(redirectTo)`.
A visitor with 2FA enabled was sent to `/todos` before they could type a code, which bounced
straight back to `/login` without a session — a dead end. `secondFactorRequested` now records that
the challenge is in flight and the credential handler only navigates when no second factor is
pending; the verify handler navigates once the code is accepted.

## Reproducing the evidence

The stack runs beside `3000/3001` (occupied by `wslrelay` on this machine):

```sh
# one terminal: fresh database, server on 3311, Next.js on 3310
cd apps/web && E2E_TEST_PORT=3310 node tests/support/start.ts

# another terminal
node artifacts/h12/verify-two-factor.mjs
```

The probe signs up a throwaway user, so it can run against a scratch database over and over. The
stack drops that database when it stops; the screenshots therefore show a secret and backup codes
that never belonged to a real account. The probe itself never prints the secret — only its length
and whether it matches the issued URI.

`/two-factor/*` allows three requests per ten seconds, so the probe pauses ~11 s between the
rejected code and the accepted one, and between verification and disabling.
