# H36 — the forgot-password form asks for the captcha

Production answered the reset request with
`400 {"message":"Missing CAPTCHA response","code":"MISSING_RESPONSE"}`. The cause was not the
server: Better Auth's captcha plugin registers **three** endpoints by default —

```js
// better-auth/dist/plugins/captcha/constants.mjs
const defaultEndpoints = ["/sign-up/email", "/sign-in/email", "/request-password-reset"];
```

— and `apps/web/src/components/forgot-password-form.tsx` was the one form without a widget. It
passed locally only because a local `.env` has no `TURNSTILE_SECRET_KEY`, so `hasTurnstile` was
false and the plugin was never registered. Production has the secret, so the endpoint demanded a
token nobody sent.

## The fix

`forgot-password-form.tsx` now uses the same pieces as the sign-in form:

- imports `TurnstileWidget` and `turnstileSiteKey` from `turnstile-widget.tsx`;
- keeps the token in state and sends it as the `x-captcha-response` header through
  `fetchOptions` — and sends no header when the token is still empty;
- renders the widget only when `turnstileSiteKey !== ""`, which is exactly the condition under
  which `packages/auth` registers the captcha plugin (it requires the secret). One key configured on
  one side without the other is the only mismatch, and it is a deployment error rather than a silent
  pass;
- maps the server's `MISSING_RESPONSE` to 「请先完成人机验证，再发送重置邮件。」 instead of showing the
  raw English message.

The captcha plugin's `endpoints` were **not** touched: protecting the reset endpoint is correct —
it is the endpoint that sends email, so it is the one worth rate-limiting behind a captcha.

**Parity audit of the three default endpoints:** `auth-form.tsx` renders the widget and sends the
header for both `/sign-in/email` and `/sign-up/email` (the same form, both mutations), and the
forgot form now covers `/request-password-reset`. No other UI endpoint is in that list, so the gap
was exactly this one.

## Verification

Cloudflare's documented test pair was used so the captcha path runs for real:

- site key `1x00000000000000000000AA` (always passes; **short** form),
- secret `1x0000000000000000000000000000000AA`.

> A trap worth recording: the 32-character value is the **secret**, not a site key. Using it as
> `NEXT_PUBLIC_TURNSTILE_SITE_KEY` makes Turnstile answer `error 400020 (invalid site key)` and no
> widget renders. If the production project's public site key ever gets set to the secret by mistake,
> the symptom is the same "Missing CAPTCHA response" this task fixes.

`artifacts/h36/verify-captcha.mjs` drives a signed-in-free browser through both configurations:

**With captcha configured — 5/5** (`verification-captcha.json`):

1. the forgot-password page mounts the widget and receives its token (21 characters from the test
   key);
2. submitting the form shows the neutral answer (the request reached 200);
3. the submission carried a non-empty `x-captcha-response` header;
4. a request that skips the widget is still refused — `400 MISSING_RESPONSE` (the protection is
   intact, the page is what changed);
5. the sign-in form mounts the same widget (parity check).

**Without captcha keys — 4/4** (`verification-no-captcha.json`): no widget mounts, the submission
carries no header, the form reaches the neutral answer, and a direct request passes without a token —
the e2e stack's shape keeps working.

The probe also presents a fresh `x-forwarded-for` per run: the endpoint allows three requests a
minute per address, and reruns must not inherit the previous run's budget.

`pnpm exec e2e run`: the frozen spec is **7/7** (it runs without captcha keys, so it exercises the
second configuration end to end). `pnpm run ready` is green, including the full `vp check`
(formatting included).

## Deployment note

The fix is a client change, but it only takes effect where the deployment has **both**
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (a real site key, not the secret) and `TURNSTILE_SECRET_KEY`. A
deployment with only the secret still refuses every reset request — correctly, but the form cannot
supply a token it was never given a widget for.
