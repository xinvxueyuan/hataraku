# H33 — password reset by email

The user decided to enable password reset (not email verification). Better Auth already owns the
token flow; this change gives it a transport and a door.

## The transport

`packages/auth/src/email.ts` composes the message and posts it to Resend's REST API with `fetch` —
no SDK, no nodemailer. The `From` address and the API key are deployment configuration, passed to
`createAuth` as `emailFrom` / `resendApiKey`; `apps/web/src/server/env.ts` declares them as optional
and `apps/web/src/server/api.ts` hands them over.

**No domain is written down.** Better Auth builds the link from `baseURL` (the deployment's
`BETTER_AUTH_URL`):

```ts
// better-auth/dist/api/routes/password.mjs
const url = `${ctx.context.baseURL}/reset-password/${verificationToken}?callbackURL=${callbackURL}`;
```

so the mail a reader receives points at whatever origin the deployment configures.

**Failures are not swallowed.** The callback throws when `EMAIL_FROM`/`RESEND_API_KEY` are missing
and when Resend answers non-2xx. Better Auth then logs it:

```ts
// better-auth/dist/context/create-context.mjs — runInBackgroundOrAwait
try { ... await promise; } catch (e) { logger.error("Failed to run background task:", e); }
```

That catch is why the endpoint still answers its neutral 200 — the reset endpoint must not reveal
whether an address exists — so the **server log** is where an operator sees the failure. Verified
locally without the key: the request answered 200, the log carried
`Password reset mail is not configured: set RESEND_API_KEY and EMAIL_FROM.`, and the process stayed
healthy.

## The pages

- `/forgot-password` asks for the address and always answers
  **「如果该地址已注册，我们已发送重置邮件。」** — the endpoint itself answers identically for an
  unknown address and sends nothing, and the page repeats that one sentence. The only other answers it
  can give are operational: `429` → "请求过于频繁", `RESET_PASSWORD_DISABLED` → "本站暂未开启密码重置",
  5xx → "邮件服务暂时不可用".
- `/reset-password` reads `?token=` from the callback redirect (or `?error=INVALID_TOKEN`), asks for
  the new password twice with the same 16-character floor as every other password surface, and maps
  `INVALID_TOKEN` / `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` into sentences. A missing or rejected
  token renders a "链接无法使用" card with a link back to `/forgot-password`.
- `/login` gains a 「忘记密码？」 link, visible in sign-in mode only.

The token is single use: the reset consumes the `verification` row, so a second submission of the
same link answers `INVALID_TOKEN` (covered by a test).

## Rate limiting

No custom middleware was added. Better Auth's own default special rule covers the endpoint:

```ts
// better-auth/dist/api/rate-limiter/index.mjs — getDefaultSpecialRules()
{ pathMatcher: (path) => path === "/request-password-reset" || ..., window: 60, max: 3 }
```

`resolveRateLimitConfig` applies that rule before the deployment's custom rules (which only name
`/sign-in/email` and `/sign-up/email`), so reset requests are limited to **3 per 60 seconds per
client**. The integration test pins it: four requests in a row answer `[200, 200, 200, 429]`.

## Evidence

### Integration — `packages/api/tests/integration/password-reset.test.ts` (6 tests, green)

1. a registered address gets exactly one mail and its token sets a new password: the old password
   then answers 401, the new one 200;
2. an unknown address gets the same status and message, and produces no mail;
3. a token that was never issued is `INVALID_TOKEN`;
4. a too-short password is `PASSWORD_TOO_SHORT` **before** the token is spent, and the same token then
   works;
5. a successful reset consumes the token (second use is `INVALID_TOKEN`);
6. the fourth request in a minute is 429.

The mailer is a capture in these tests — the transport seam is a function; production passes Resend.

### Real mail — three messages, and why

| # | Resend id | link origin | what it proved |
| --- | --- | --- | --- |
| 1 | `01a15cd3-d8d8-7937-b157-721ca11c7f7c` | `https://www.xinvstar.xyz` | the delivered link uses the configured production origin, path `/api/auth/reset-password/<token>`, `callbackURL` present; its token was consumed through the API |
| 2 | `01a15cd6-fc63-7248-9a02-e664c4dcb143` | `https://www.xinvstar.xyz` | same origin; used by the browser flow before a local port collision invalidated that run |
| 3 | `01a15cd8-5542-7ead-9f6e-d33fb8446e03` | `http://localhost:3000` | the **literal emailed link was clicked** and completed the whole flow locally |

All three were `last_event: sent` in the Resend API, to `xinvxueyuan@yeah.net`, subject 重置登录密码.
The push that deploys this change has not happened, so the production origin cannot serve the new
pages yet; the flow was therefore completed against the local build, with the token taken from the
delivered mail (message 3 is a genuinely clickable link). Message 2's origin and id are recorded in
`verification.json` as `productionEmail`.

### Browser — `artifacts/h33/verify-reset.mjs` (7/7, production build)

1. the sign-in form links to `/forgot-password`;
2. an unregistered address gets the neutral sentence;
3. the emailed link opens, the token sets a new password;
4. the new password signs in;
5. the original password is restored through the change-password page and signs in;
6. an unusable token renders the "链接无法使用" card with the "忘记密码" way out;
7. `?error=INVALID_TOKEN` (the callback's redirect) renders the same card.

Screenshots in `screenshots/`, machine-readable results in `verification.json`.

## Where it ran, and the password

Everything ran against a **temporary database** (`@hataraku/db/testing`, dropped afterwards) with the
account `xinvxueyuan@yeah.net`. **The production database and the user's real password were not
touched.** The temporary account was restored to its starting password — `initial-horse-battery` —
during check 5, so the final password of that throwaway account is the starting one.

## Environment

`RESEND_API_KEY` and `EMAIL_FROM` are read by the web deployment only (`apps/web/src/server/env.ts`).
They were deliberately **not** added to `apps/server/.env`: the e2e stack loads that file, and the
reset flow is not part of the frozen spec. A deployment without them still starts; the reset callback
reports the missing configuration in its log.

`pnpm run ready` is green, including the full `vp check` (formatting included).
