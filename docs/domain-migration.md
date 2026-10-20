# Moving the site to another domain

The current address is a first-year domain and is expected to be replaced. No domain string is
compiled into the app: every runtime reference reads configuration, so a move is a set of
configuration edits plus the checks at the end. This file is the inventory of those points.

## What the code reads

| Variable                     | Used for                                                                                               | Who reads it                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`       | canonical links, OpenGraph URLs, `/rss.xml`, `/atom.xml`, `/sitemap.xml`, `/llms*.txt`, `metadataBase` | `apps/web/src/components/site.ts`                |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | public host for R2 object keys (album covers, post images)                                             | `apps/web/src/components/asset-url.ts`           |
| `BETTER_AUTH_URL`            | Better Auth base URL; its origin is also what the sign-in origin check accepts                         | `apps/web/src/server/api.ts`                     |
| `SERVER_URL`                 | origin the standalone Hono server and the mobile client talk to                                        | `apps/web/src/server/env.ts`, `apps/mobile`      |
| `R2_PUBLIC_BASE_URL`         | server-side media URL building and upload responses                                                    | `packages/api/src/r2.ts` (required, no fallback) |

Nothing else in `apps/` or `packages/` contains a domain. Two details make that hold:

- `site.ts` falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` before it falls back to
  `http://localhost:3000`, so an unconfigured deployment still emits the origin it is served from.
- `asset-url.ts` returns a root-relative path when no media host is configured, so a missing setting
  shows up as a broken image during setup instead of pointing readers at a host the site no longer owns.

## Points outside this repository

| Layer      | Where                                                     | What to change                                                              |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Vercel     | Project → Domains                                         | Add the new `www`; keep the apex as a 308 redirect to it                    |
| Vercel     | Project → Settings → Environment Variables                | The five variables above (production, preview, development)                 |
| Cloudflare | DNS                                                       | `www` CNAME to Vercel, apex A record to Vercel's anycast address            |
| Cloudflare | R2 → bucket → custom domain                               | The media host behind `NEXT_PUBLIC_MEDIA_BASE_URL` / `R2_PUBLIC_BASE_URL`   |
| Cloudflare | R2 → bucket → CORS                                        | Allowed origins for `PUT`; `R2_UPLOAD_ALLOWED_ORIGINS` overrides it locally |
| Cloudflare | Turnstile → widget → domains                              | The site's hostnames, or the widget refuses to issue a token                |
| GitHub     | `xinvxueyuan/hataraku` → repository homepage              | `gh repo edit xinvxueyuan/hataraku --homepage <new site>`                   |
| GitHub     | `xinvxueyuan/xinvxueyuan` → `scripts/profile.config.json` | `blog.url` and `blog.feed`; the workflow regenerates the README             |

## Order that avoids a broken window

1. Add the new host to the Vercel project and point DNS at it; confirm a page returns 200 on it.
2. Update the five environment variables.
3. **Redeploy.** Vercel applies environment changes to new deployments only — an existing deployment
   keeps its snapshot, which is exactly how a stale `BETTER_AUTH_URL` once produced `Invalid origin`
   on sign-in.
4. Move the R2 custom domain and widen the CORS origins to include the new host.
5. Add the new host to the Turnstile widget.
6. Keep the old host on a 308 redirect for a while; drop it once links have moved.
7. Update the GitHub homepage and the profile config, then run the profile workflow.

## Checks that must pass afterwards

- `/rss.xml`, `/atom.xml`, `/sitemap.xml` and `/llms.txt` contain only the new origin:
  `curl -s https://<host>/sitemap.xml | grep -o 'https://[^<]*' | sort -u | head`
- A page's `<link rel="canonical">` and `og:url` name the new origin.
- **Sign in in a real browser.** The origin check only runs when the request carries a cookie, so a
  cookie-less `curl` reports success while the browser form fails with `Invalid origin`. If it does,
  `BETTER_AUTH_URL` is stale — check that step 3 actually created a new deployment.
- An album page renders its covers from the new media host.
