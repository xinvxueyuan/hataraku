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

## 2026-10-28 实际迁移记录（xinvstar.xyz → hikarilink.org）

`xinvstar.xyz` 到期日 2026-11-26，不续费。实际落点与结果：

| 层 | 旧 | 新 | 结果 |
| --- | --- | --- | --- |
| 站点主域 | `https://www.xinvstar.xyz` | `https://blog.hikarilink.org` | Vercel 项目 `hataraku` 加域 + CF CNAME（DNS-only）；apex `xinvstar.xyz` 仍 308 到旧 `www`，随域名到期消失 |
| 媒体域 | `https://cdn.xinvstar.xyz` | `https://cdn.hikarilink.org` | R2 桶 `nightstack-assets` 的第二个自定义域（两个域并存），CF 自动生成 CNAME→`public.r2.dev` |
| 发信人 | `noreply@xinvstar.xyz` | `noreply@hikarilink.org` | Resend 侧 `hikarilink.org` 早已验证通过，只改 `EMAIL_FROM` |
| 文档站 | `docs.xinvstar.xyz`（Mintlify） | — | 本次下线：删除 CF CNAME；Mintlify 侧自定义域由站长在控制台移除 |
| 统计图 | `github-readme-state.xinvstar.xyz` | `readme-stats.hikarilink.org` | Vercel 项目 `github-readme-stats` 加域 + CF CNAME→`cname.vercel-dns.com` |

改动清单（除本文件所在仓库外）：

- Vercel 环境变量（项目 `hataraku`，production/preview/development 同一值）：`NEXT_PUBLIC_SITE_URL`、`BETTER_AUTH_URL`、`SERVER_URL` → `https://blog.hikarilink.org`；`NEXT_PUBLIC_MEDIA_BASE_URL`、`R2_PUBLIC_BASE_URL` → `https://cdn.hikarilink.org`；`EMAIL_FROM` → `夜行栈 <noreply@hikarilink.org>`。
- Cloudflare Turnstile widget `0x4AAAAAAFbe8nL7wv5ZWRG1`：`domains` 增加 `blog.hikarilink.org`。
- R2 桶 `nightstack-assets` CORS：PUT 规则 origins 增加 `https://blog.hikarilink.org`。
- 数据库 `projects`（slug=`xinvstar`）：`link` 改为 `https://blog.hikarilink.org/`。
- 生产库是 Neon 的 **`hataraku_v2`**；`C:\dev\env.toml` 里的 `NEON_DATABASE_URL` 指向旧的 `neondb`，改数据前必须用 Vercel 环境变量里的 `DATABASE_URL`（已解密核对）。

两条实测教训，后续换域别重犯：

1. **Vercel 的「Redeploy」不会重新构建**（复用旧构建产物），静态生成的路由（`/llms.txt` 等）会继续吐旧域名。必须走 git 来源的部署（`gitSource` 或推送提交）。
2. `next build` 期生成的页面读的是**构建时**数据库状态；改完内容要再构建一次才反映到静态产物上。


