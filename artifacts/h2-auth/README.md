# H2 authentication rebuild — status and migration notes

## Two things that cannot be migrated from the previous stack

The previous site stored credentials in Supabase. Neither of these survives the move, and each
needs one manual step from the site owner before the new deployment is usable.

1. **Passwords do not carry over.** Supabase stored a bcrypt hash in `auth.users`; Better Auth
   stores its own scrypt hash in `account.password`. There is no supported conversion.
   _Action:_ sign-in is impossible until a new password exists. On a fresh deployment the owner
   signs up once with their address (the sign-up form creates the account).

2. **TOTP secrets do not carry over.** The enrolled authenticator secret lives in Supabase's
   `auth.mfa_factors.secret`, encrypted with Supabase's own key. Better Auth's two-factor plugin
   keeps its own secret in the `two_factor` table.
   _Action:_ the owner re-enrols 2FA on the new site. The old authenticator entry stops working
   and should be deleted; a fresh QR code is shown during enrolment.

## What this change builds

| Capability                                     | Where                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Email + password                               | `packages/auth/src/index.ts` (`emailAndPassword`)                                |
| TOTP two-factor, backup codes, account lockout | `twoFactor` plugin + `two_factor` table                                          |
| Turnstile captcha                              | `captcha` plugin, registered only when `TURNSTILE_SECRET_KEY` is set             |
| Sign-in rate limit (20 concurrent admit 5)     | `rateLimit.customRules["/sign-in/email"]`                                        |
| Access allowlist                               | `ADMIN_EMAILS` through `createEmailAllowlist`                                    |
| Schema                                         | `packages/db/src/schema/auth.ts`, migration `20261020085105_wonderful_swordsman` |

## Deliberate choices

- **The captcha plugin is registered only when a secret exists.** The plugin cannot verify
  anything without one, and the e2e stack deliberately has none, so `tests/e2e/app.e2e.ts` keeps
  passing unchanged. A deployment that sets the key gets enforcement on `/sign-up/email`,
  `/sign-in/email` and `/request-password-reset`.
- **Rate limiting is enabled explicitly.** Better Auth only enables it in production by default,
  and the acceptance criterion has to hold in every environment. Its memory store decides and
  increments in one synchronous step, so concurrent requests cannot all read a stale count.
- **The allowlist gates account creation, not an admin area.** This app has no private admin
  surface, so the closest equivalent to the previous `ADMIN_EMAILS` is "who may use this
  deployment". Narrowing the list later does not evict existing accounts; delete those users.
