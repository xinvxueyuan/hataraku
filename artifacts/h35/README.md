# H35 — the settings shell everywhere

The owner reported that `/settings/security` was the only settings page without the 设置 navigation.
The cause was age, not intent: H20 built the security overview before H18 introduced
`AdminPageShell`, and H12's two-factor page predates the shell too, so both rendered their own
`<section>` and header. `AdminNav` also had no entry for `/settings/two-factor`.

## What changed

- `apps/web/src/components/admin-nav.tsx`: `/settings/two-factor` joins the `AdminPath` union and
  `SECTIONS` as 「两步验证」, placed between 安全 and 密码 — the three account-protection surfaces sit
  together, and the order matches how a reader meets them.
- `apps/web/src/app/settings/security/page.tsx`: the outer `<section>` and its `<header>` are
  replaced by `AdminPageShell current="/settings/security" title="安全概览"`, with the account email
  kept verbatim in the description（当前账号：…）. The three cards — 活跃会话、最近的登录尝试、
  两步验证 — are untouched, including the FORBIDDEN fallback for non-admin accounts.
- `apps/web/src/app/settings/two-factor/page.tsx`: wrapped in
  `AdminPageShell current="/settings/two-factor"` with the page's existing title and description.
  The setup component (`TwoFactorSetup`: QR code, manual key, backup codes) is untouched.

No shell extension was needed: both pages fit `action? / children / current / description / title`,
so the shared frame keeps one definition instead of two copied layouts. The 2FA page's English
heading is deliberately unchanged — translating it would be a copy change, and this task only
unifies the frame.

## Evidence

`artifacts/h35/verify-settings-nav.mjs` — signed-in Chromium against the production build,
**29/29**:

- all **9** settings pages render the 设置 navigation with exactly 9 links:
  `/settings/admin` (总览), `/settings/admin/posts` (文章), `/settings/admin/micro` (微言),
  `/settings/admin/projects` (项目), `/settings/admin/changelog` (更新日志),
  `/settings/admin/profile` (站点), `/settings/security` (安全), `/settings/two-factor`
  (两步验证), `/settings/password` (密码);
- every page has exactly one `aria-current="page"` and it names that page;
- the existing headings are unchanged (安全概览, Two-factor authentication, 修改密码, …);
- at **390px** the navigation wraps onto two rows, every link box stays inside the viewport, the
  page has no horizontal overflow, and 安全 is still marked — screenshot `security-390.png`;
- `security-with-nav.png` and `two-factor-with-nav.png` show the two repaired pages with the
  navigation in place.

`pnpm exec e2e run`: the frozen spec is **7/7** green (it signs in and exercises the two-factor
form, so the shell change had to leave both working).

`pnpm run ready` is green, including the full `vp check` (formatting included).

## Note

The 2FA page still performs its own session redirect instead of `requireSession`; that is the
existing behaviour and out of scope here (this task only unifies the frame).
