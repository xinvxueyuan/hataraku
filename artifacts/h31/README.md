# H31 — the tab title follows the site profile

H29 made the visible shell read `site_profile`, but the document metadata still came from the
`SITE_*` constants. Renaming the site changed the H1, the header, the footer and `/about` — and left
the browser tab saying the old name. This change points `generateMetadata` at the same identity the
shell renders.

## What was actually there

`apps/web/src/app/layout.tsx` already exported `generateMetadata` (it has since the feeds landed);
it simply built its `Metadata` from constants. So the fix is not "static → dynamic", it is
"constants → the profile identity":

```ts
const [origin, site] = await Promise.all([siteOrigin(), loadSiteIdentity()]);
```

- `loadSiteIdentity()` is the H29 helper: the profile row, merged with the `SITE_*` constants by
  `describeSite()` when the row (or a column) is missing. A fresh database therefore renders the
  same title a configured one does.
- `title.default` and the template now come from the identity: `{ default: site.title, template:
  \`%s · ${site.name}\` }`, so a child page's "归档" still renders as "归档 · 夜行栈" — with the
  current name.
- `applicationName`, `authors`, `description`, `openGraph.{title,siteName,description}` and
  `twitter.{title,description}` follow the same identity.
- `metadataBase` (from `siteOrigin()`), `alternates.canonical`, `openGraph.url: "./"`,
  `openGraph.locale` and `robots` are unchanged, so every page still reports its own absolute URL.

The two exports cannot coexist ("You cannot export both the `metadata` object and
`generateMetadata` function from the same route segment", `dist/docs/.../generate-metadata.md`), and
the layout only has `generateMetadata` — no page had to change. Page-level `metadata` keeps
overriding fields it sets, and the layout template still applies to child segments only.

## One profile read per request

The docs name this exact case: "React `cache` can be used if `fetch` is unavailable". Because
`loadSiteIdentity` is wrapped in `cache`, `generateMetadata` and the layout body (header + footer)
share one read. Measured, not assumed — a temporary `console.log` in `loadSiteProfile`, one request
each to `/`, `/archive`, `/about` and `/article`:

```
home    profile reads for this request: 1
archive profile reads for this request: 1
about   profile reads for this request: 1
article profile reads for this request: 1
```

The instrumentation was removed before the commit.

## Evidence

`artifacts/h31/verify-title.mjs` — a real Chromium run against the app on a scratch database,
**11/11**. It stores the site name through the profile editor, then reads what the document reports:

| Check | Observed |
| --- | --- |
| home `document.title` | `夜行栈 NightStack` |
| home `og:title` / `twitter:title` | `夜行栈 NightStack` |
| home canonical / `og:url` | `http://localhost:3302/` / `http://localhost:3302` |
| `/archive` title (template) | `归档 · 夜行栈` |
| `/archive` canonical / `og:url` | `http://localhost:3302/archive` / `http://localhost:3302/archive` |
| after renaming to 夜行栈 · H31, home title | `夜行栈 · H31 NightStack` |
| after renaming, home `og:title` | `夜行栈 · H31 NightStack` |
| after renaming, `/archive` title | `归档 · 夜行栈 · H31` |
| after restoring, home title | `夜行栈 NightStack` |
| after restoring, `/archive` title | `归档 · 夜行栈` |

Screenshots in `screenshots/`, machine-readable results in `verification.json`.

`pnpm run ready` is green, including the full `vp check` (formatting included).

## Notes

- The title is resolved per request (no ISR), so a rename shows up on the next navigation — the same
  freshness the visible shell has.
- On the root path, `og:url` resolves to the origin without a trailing slash
  (`http://localhost:3302`) while `canonical` keeps it (`http://localhost:3302/`). That is the
  pre-existing `url: "./"` normalization, not something this change introduced.
