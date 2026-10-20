# H21 — the sign-in audit writer behind `login_attempts`

H20 read `login_attempts` but nothing wrote it, so the security page's attempt card could only be
empty. This change adds the writer, and the browser probe now shows the two rows a real sign-in
pair leaves behind.

## Where the writer lives, and why not the hooks

`packages/auth/src/login-attempts.ts` wraps `auth.handler`. `createAuth` returns the wrapped
instance, so every deployment (the web app, the standalone server, the integration tests that build
their own auth) gets the audit from the same place — one location, no per-app duplication.

**Why the handler rather than `hooks.after`:** two refusal paths never reach an endpoint. The rate
limiter rejects before dispatch, and the sign-in allowlist throws from a `before` hook; Better Auth
runs after hooks only once dispatch has produced a response (`dispatch.mjs` runs them with
`context.returned` set from the endpoint result). Wrapping `hooks.after` would therefore record the
successful sign-in and the wrong password, but not the two refusals a site owner most wants to see.
`auth.handler` is the single point every HTTP auth request passes through and it yields the status
the caller actually received, so the wrapper classifies by that status.

**Limit of the scope:** the audit covers `/sign-in/email`, the password step. The second-factor
verification step (`/two-factor/verify-totp`) is a separate endpoint and is not audited here; the
table's `mfa_fail` label stays unused until a follow-up decides the shape of that record.

## What a row holds

| Column | Value |
| --- | --- |
| `outcome` | `success` (2xx), `invalid` (401), `not_allowed` (403), `throttled` (429), `failed` (anything else) |
| `duration_ms` | wall time the handler took for this request, in milliseconds |
| `created_at` | default `now()` |
| `ip_hash` | HMAC-SHA256 of the forwarded client address, keyed by `BETTER_AUTH_SECRET`; `null` when no address header is present |
| `email_hash` | HMAC-SHA256 of the submitted email, lowercased and trimmed, same key; `null` when the body names no email |

**401 is one outcome on purpose.** The allowlist refuses a non-listed address with the same response
as a wrong password, so the audit draws the same line the caller sees instead of becoming a
distinguishing oracle.

**No raw identifiers.** The address comes from `x-forwarded-for` (first hop) or `x-real-ip`, is
hashed immediately and never stored. The email is read from a clone of the request body (the handler
still receives the original) and hashed the same way. The read path in
`packages/api/src/routers/security.ts` still exposes only the first 12 hex characters of the IP
digest and never the email digest.

**No `user_id`, confirmed.** The table stays deployment-wide rate-limit audit data. The writer does
not add a column, a migration, or a user reference; a row belongs to no account by design.

## About "reuse the existing HMAC logic"

The task asked to reuse the HMAC the repository already used. **There was none:** a search for
`createHmac` / `createHash` / `node:crypto` across `packages` and `apps` finds only
`randomUUID` in `packages/api/src/r2.ts`. The v2 stack had `hashIdentifier` in its rate-limit
module, but v3 never carried it over. So the digest lives in
`packages/auth/src/login-attempts.ts` (`hashIdentifier`, SHA-256 HMAC) and the integration test
recomputes the expected digest independently with `node:crypto` rather than importing the helper,
so the test pins the wire format instead of restating the implementation.

## Audit failure never fails the sign-in

The write is awaited (a serverless invocation may freeze once the response is returned) inside a
`try/catch` that logs and continues: the audit row is an observation, not a step of authentication.
`login-attempts-resilience.test.ts` drops the table and then proves a correct password still answers
200 and a wrong one still answers 401.

## Evidence

- `packages/api/tests/integration/login-attempts.test.ts` (2 tests): a successful and a failed
  sign-in each leave one row with the expected outcome, an independently computed email digest, an
  integer duration, and no raw email or address anywhere in the stored row; the owner's read path
  returns the 12-character digest prefix and never the full address digest or the email digest.
- `packages/api/tests/integration/login-attempts-resilience.test.ts` (1 test): dropping
  `login_attempts` leaves the sign-in results (200 / 401) untouched while the failure is logged.
- `vp test`: 18 files, 164 tests, all green.
- `artifacts/h21/verify-audit.mjs` — a real Chromium run against a scratch database, **6/6**:
  the owner signs in through the form (one `success` row), one wrong password answers 401 (one
  `invalid` row), `/settings/security` shows both rows with the truncated digest
  (`IP 摘要 9b8447e2640c`), and another account still sees no attempt rows and gets the explanation.
  Screenshots: `screenshots/owner-login-attempts.png`, `screenshots/other-security.png`;
  machine-readable result: `verification.json`.

## Reproducing

```sh
# scratch database beside apps/server/.env's DATABASE_URL, migrated by @hataraku/db/testing
node --input-type=module -e "import { createTestDatabase } from '@hataraku/db/testing'; ..."
# accounts before the allowlist is enabled (sign-up is gated by ADMIN_EMAILS)
PROBE_API_BASE=http://localhost:3301 node artifacts/h21/seed-users.mjs
# then the web app with ADMIN_EMAILS=owner@h21.test and the scratch DATABASE_URL
PROBE_BASE=http://localhost:3370 node artifacts/h21/verify-audit.mjs
```

## One-line scope deviation

`apps/web/src/app/settings/security/page.tsx` gained `["success", "成功"]` in its outcome-label map.
Without it the new outcome would render as the raw word `success` on a Chinese page; the map is the
page's only change.
