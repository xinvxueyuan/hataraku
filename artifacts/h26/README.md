# H26 P1 — the change-password page, and the password floor v2 already had

H22's parity audit found two P1 gaps: v3 had no way to change a password, and its password policy
was Better Auth's default of eight characters while v2 required sixteen plus a blocklist. This
change closes the entrance and raises the floor.

## The page: `/settings/password`

`apps/web/src/app/settings/password/page.tsx` is a server component: it asks
`requireSession("/settings/password")` for the signed-in account and renders
`ChangePasswordForm` inside `AdminPageShell`, which is what puts the page into the settings
navigation next to 安全. The form (`apps/web/src/components/change-password-form.tsx`) asks for the
current password, the new password and a confirmation, then calls **Better Auth's `changePassword`**
(`POST /change-password`, body `{ currentPassword, newPassword, revokeOtherSessions }`; the endpoint
runs `sensitiveSessionMiddleware` and answers `{ token, user }`).

The API shape was read from `apps/web/node_modules/better-auth/dist/api/routes/update-user.d.mts`
and its implementation, not recalled: the endpoint hashes the new password, verifies the current one
with `context.password.verify`, and updates the credential account. Nothing about the password
policy or the current-password check lives in the page — the endpoint is the boundary.

**Feedback.** The form renders its own `role="alert"` paragraph and a success `<output>`, so a reader
does not have to catch the app's transient toast:

| Better Auth code | What the page says |
| --- | --- |
| `INVALID_PASSWORD` | 当前密码不正确。 |
| `PASSWORD_TOO_SHORT` | 新密码至少需要 16 个字符。 |
| `PASSWORD_TOO_LONG` | 新密码过长（上限 200 个字符）。 |
| `CREDENTIAL_ACCOUNT_NOT_FOUND` | 这个账号没有密码（可能是第三方登录创建的），无法在这里修改。 |
| anything else | the API's own message, so a real fault is not hidden |

**Sessions.** `revokeOtherSessions: true` is always sent: the old password may be known elsewhere, so
a change ends the other sessions. The page says so.

## The policy: 16 characters, aligned with v2

`packages/auth/src/index.ts` now exports `PASSWORD_MIN_LENGTH = 16` and
`PASSWORD_MAX_LENGTH = 200` and feeds them to Better Auth:

```ts
emailAndPassword: {
  enabled: true,
  maxPasswordLength: PASSWORD_MAX_LENGTH,
  minPasswordLength: PASSWORD_MIN_LENGTH,
}
```

Better Auth applies the floor to sign-up, change-password, set-password, reset-password and admin
create-user; **sign-in only checks the ceiling**, so an account created under the old eight-character
default can still sign in and raise its password. The login page passes the same constant into
`AuthForm`, which applies `minLength` **only in sign-up mode** — the sign-in field must accept
whatever an older account already has (the frozen e2e spec's wrong-password case is a 14-character
string), while the endpoint still enforces the ceiling there.

### The blocklist: not supported, and not imitated

v2's `nightstack/src/lib/supabase/password-policy.ts` enforced three things beyond length: a
30-entry common-password list (also matched as a substring), "must not contain the email", and
"must not contain the local part". **Better Auth has no option for a local blocklist.** Its
`emailAndPassword` surface is length bounds plus optional `password.hash` / `password.verify`
overrides; there is no `validate` hook and no list to configure. Inventing a parallel validator in
the page would have produced a check that the real boundary (HTTP `/change-password` and
`/sign-up/email`) does not enforce, which is exactly the bypass the task forbids.

Better Auth *does* ship a breached-password check: the `haveIBeenPwned` plugin
(`dist/plugins/haveibeenpwned`). It wraps `password.hash` on a configurable path list and asks
`api.pwnedpasswords.com` whether the password appears in a breach corpus, using k-anonymity (only
the first five characters of its SHA-1 go out). **It is not enabled here**, deliberately:

- it is a *breach* check, not v2's common-password list, so it does not reproduce the missing half;
- it makes sign-up, change-password and reset-password depend on a third-party HTTPS call at
  runtime, and fails closed with `INTERNAL_SERVER_ERROR` when that call fails — an outage at
  pwnedpasswords.com would lock every password change (and every sign-up);
- the repository's tests would then depend on that external service, or need a fake plus a contract
  test pinned to its range response, which is a decision worth making on its own.

The Lead can switch it on with `plugins: [haveIBeenPwned()]` in `createAuth` if the tradeoff is
accepted; the plugin needs no key.

## Navigation

`apps/web/src/components/admin-nav.tsx` gains `/settings/password` in its `AdminPath` union and a
`密码` section after 安全, so the settings surfaces link to the page. `/login`'s `redirectTargets`
gains the same path (the convention every protected page follows); that is the one file outside the
task's declared write scope, touched only for the redirect list and to pass the password floor into
`AuthForm`.

## Evidence

- `packages/api/tests/integration/change-password.test.ts` (4 tests, all green):
  - change with the right current password: the response carries the user, the **old password now
    answers 401**, the new one signs in with 200;
  - a wrong current password rejects with `statusCode: 400` and `body.code: "INVALID_PASSWORD"`;
  - a 15-character new password rejects with `PASSWORD_TOO_SHORT` and exactly 16 characters is
    accepted and signs in;
  - sign-up applies the same floor.
- `artifacts/h26/verify-password.mjs` — a real Chromium run against a production build on a scratch
  database, **9/9**:
  1. sign up through the form; 2. sign out and sign in with the initial password;
  3. the settings navigation carries `密码 → /settings/password` and opens it;
  4. a wrong current password shows 当前密码不正确。; 5. the real change shows 密码已更新。;
  6. after signing out, the old password is refused ("Invalid email or password");
  7. the new password signs in; 8. an anonymous visitor is redirected to
  `/login?redirect=%2Fsettings%2Fpassword`.
  Screenshots in `screenshots/`; machine-readable result in `verification.json`.
- The probe sets its own `x-forwarded-for` per run: the sign-in rule allows five attempts per address
  per fifteen minutes, and the probe makes three.

## Reproducing

```sh
# scratch database beside apps/server/.env's DATABASE_URL
node --input-type=module -e "import { createTestDatabase } from '@hataraku/db/testing'; ..."
# production build, because the dev server's Fast Refresh reloads the page out from under the probe
pnpm exec turbo run build --filter=@hataraku/web
DATABASE_URL=<scratch> BETTER_AUTH_URL=http://localhost:3300 node apps/web/node_modules/next/dist/bin/next start -p 3300
PROBE_BASE=http://localhost:3300 node artifacts/h26/verify-password.mjs
```
