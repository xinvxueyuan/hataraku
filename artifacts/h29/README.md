# H29 P0 — the `site_profile` writer, its editor, and the one place that decides fallbacks

H22 found `site_profile` read but never written: the site's name, description, tagline, social
links and hero could only be changed with a SQL client. This change adds the write path, the editor
at `/settings/admin/profile`, and makes the shell read the row instead of a constant.

## The write path

`site.updateProfile` (`packages/api/src/routers/site.ts`) is an `adminProcedure` that upserts the
single row (`id = 1`, pinned by the table's check constraint):

```ts
const [row] = await db
  .insert(siteProfile)
  .values({ id: SITE_PROFILE_ID, ...values })
  .onConflictDoUpdate({ set: values, target: siteProfile.id })
  .returning();
```

**Validation** (`updateSiteProfileInput` in `packages/api/src/schemas.ts`):

| Field | Rule |
| --- | --- |
| `name` | trimmed, 1–80 characters — the column is NOT NULL, so it is the one required value |
| `nameEn`, `tagline`, `author` | trimmed, 80 / 200 / 80 characters |
| `description` | trimmed, 400 characters |
| `email` | a valid email address or empty |
| `avatarUrl`, every `social` value | `http(s)` URL only, or empty |
| `hero.badge` / `cta` / `title` / `description` / `meta` | trimmed, bounded per field |
| `hero.ctaHref` | an `http(s)` URL, a site path such as `/archive`, or empty — `//evil.example` is rejected |

**Empty values mean "clear", not "empty string".** A blank box becomes SQL `NULL`, which is exactly
the value the readers already treated as "use the fallback". `hero` and `social` are compacted:
empty entries are dropped, and a section with nothing left is stored as `NULL` rather than `{}` —
an empty object would read as a hero that exists and is blank, and the fallback could not fire.

**What the writer does not touch.** `avatarKey` (the R2 object key the uploader owns, not something
a form types) and `nav` (a JSON column with no reader yet) are left out of both the input and the
`set`, so an update cannot erase them. The form exposes an avatar **URL** field instead of an
upload, because a local deployment has no object storage.

## The editor

`/settings/admin/profile` (`apps/web/src/app/settings/admin/profile/page.tsx`) requires a session,
reads the row on the server and hands it to `SiteProfileForm`; the save goes through the procedure,
which is where the write permission and the validation live. The page is in `AdminNav` as 站点.
Saving calls `router.refresh()`, so the page re-reads the row and shows what was stored.

## One read, one fallback layer

The constants in `apps/web/src/components/site.ts` are now **fallbacks only**:

```
site_profile row ──► site.profile (oRPC) ──► describeSite() ──► SiteIdentity
                                                    │
                                      missing row or NULL column ──► SITE_* constants
```

- `describeSite(profile)` in `site-content.ts` is the single function that merges the row with the
  constants (name, title, description, tagline, author, email).
- `loadSiteIdentity()` wraps it in React `cache()`, so the header and the footer share one read per
  request instead of two queries.
- `Header` and `SiteFooter` now read that identity — before this change they rendered
  `SITE_NAME` / `SITE_TITLE` / `SITE_DESCRIPTION` directly, which is why a name saved only in the
  database never reached the page.
- The home page already read the row (`profile?.name ?? "夜行栈"`); the about page already rendered
  `social`, `hero`-independent fields and the avatar; feeds and `llms` use `describeSite`.

The profile row is the source of truth; a fresh database without it still renders the same site name
from the constants, so no caller has to special-case `null`.

## Evidence

- `packages/api/tests/integration/site-profile.test.ts` — 9 tests:
  anonymous → `UNAUTHORIZED`; an account off `ADMIN_EMAILS` → `FORBIDDEN`; a full write read back
  through the public procedure (including the empty social entry not being stored); a cleared write
  storing `NULL`s with the row still `id = 1`; and five validation cases (empty name, `javascript:`
  avatar URL, malformed email, `ftp:` social link, protocol-relative hero link) → `BAD_REQUEST`.
- `artifacts/h29/verify-profile.mjs` — a real Chromium run against a production build on a scratch
  database, **14/14**: sign up → the settings navigation links 站点 → save a full profile → the home
  heading, header brand, tagline, footer and about-page social link all show it → change the name
  and tagline and see both on the home page → clear the social link and watch it leave `/about` →
  restore the original values and see them again. Screenshots in `screenshots/`,
  `verification.json` beside it.
- `pnpm run ready` green, with the full `vp check` (formatting included) inside it.

## Known scope

- The document metadata in `apps/web/src/app/layout.tsx` still names the site from the constants;
  it is static `Metadata`, so a database change does not rewrite the browser tab title. The visible
  surfaces (home heading, header, footer, about page) do update. Turning the layout into
  `generateMetadata` is a separate change.
- `nav` (the header call-to-action) is editable in the table but not in this form, because nothing
  renders it yet.
- `verification` was left untouched: email verification and password reset are a product decision.
