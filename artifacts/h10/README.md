# H10 前台页面二：归档 / 分类标签 / 相册 / 关于

## 页面与取数

| 路由 | 取数 | 说明 |
| --- | --- | --- |
| `/archive` | `posts.list`（每页 100，最多 10 页，按 `publishedAt` 倒序） | 全部文章按 **Asia/Shanghai** 的年、月分组；无发布日期的文章单列「日期待定」；顶部年份锚点导航 |
| `/taxonomy` | `taxonomy.overview` | 分类卡片 + 标签云，数字是已发布文章数 |
| `/taxonomy/[type]/[slug]` | `taxonomy.categories` / `taxonomy.tags` + `posts.list`（`categorySlug` / `tagSlugs`） | `type` 只接受 `category` / `tag`；非 ASCII slug 先解码再查（Next 16 传进来的是百分号编码段）；未知条目 404；20 条一页 |
| `/albums` | `media.albums.list` | 日期倒序，12 本一页 |
| `/albums/[slug]` | `media.albums.bySlug` | 照片用 CSS 多列瀑布流保留原始比例；点击在新标签打开原图 |
| `/about` | `site.profile` + `taxonomy.overview` + `media.albums.list` | 站点资料、实时计数、站内导航、联系方式 |

页面全部是 Server Component（`serverCall` 直连 procedure，无 hydration）。运行时行为：语义标签（`header/section/nav/ul/article/figure/dl`）、每个页面唯一 `main`（由根布局提供）、所有站内链接带 `focus-visible:ring-*` 可见焦点、图片全部有 `alt`、空状态都是「下一步去哪」的行动邀请文案。

## 变更文件

```
apps/web/src/app/archive/page.tsx
apps/web/src/app/taxonomy/page.tsx
apps/web/src/app/taxonomy/[type]/[slug]/page.tsx
apps/web/src/app/albums/page.tsx
apps/web/src/app/albums/[slug]/page.tsx
apps/web/src/app/about/page.tsx
apps/web/src/components/asset-url.ts        # R2 key → 公开 URL；绝对 URL/站内路径原样返回
apps/web/src/components/media-image.tsx    # next/image 封装：unoptimized + fill/intrinsic 两种模式
apps/web/src/components/pager.tsx          # 分页导航（服务端渲染，普通 <a>）
artifacts/h10/**                           # 本目录
```

复用 `packages/ui` 的 `Badge`、`Card/CardContent`，以及既有 Tailwind 令牌（`text-muted-foreground`、`border`、`bg-accent`、`ring` 等）。

### 图片为什么 `unoptimized`

迁移后的数据里 `cover.src` 是 CDN 绝对地址，照片行只有 R2 object key（如 `albums/acg-example/1.webp`）。没有 key 到 URL 的既有工具，因此新增 `asset-url.ts`：默认 `https://cdn.xinvstar.xyz`，可用 `NEXT_PUBLIC_MEDIA_BASE_URL` 覆盖（公开 host，非密钥）。

Next 的图片优化器要求远程 host 出现在 `images.remotePatterns`，而 `next.config.ts` 不在本任务写范围；`unoptimized` 让浏览器直接取原图，不经过 `/_next/image`，也就不需要改配置。CDN 返回的原图已经是 webp。后续若接管站点外壳的任务把 CDN host 加进 `remotePatterns`，把 `unoptimized` 换成 `sizes` 即可获得响应式优化。

## 本地验证

- 数据库：`docker exec -i hataraku-db-1 psql -U postgres -d hataraku`（迁移后的真实内容：38 篇可见文章 / 7 分类 / 96 标签 / 1 相册 22 张照片 / site_profile 1 行）。
- 实例：**3320（web）/ 3321（API）**。任务建议的 3300/3301 当时已被别的实例占用（空测试库），为避免干扰未动它们。
  - API：`cd apps/server; $env:PORT='3321'; node --env-file-if-exists=.env src/index.ts`
  - Web：`cd apps/web; $env:PORT='3320'; $env:SERVER_URL='http://localhost:3321'; $env:NEXT_DIST_DIR='.next-test-3320'; node node_modules/next/dist/bin/next dev --port 3320`

### 门禁

- `vp check <本任务的 9 个文件>` → pass（0 warning / 0 lint error / 0 type error）。
- `vp run ready` 全仓结果见下方「门禁现状」。

### 证据

| 文件 | 内容 |
| --- | --- |
| `probe.mjs` | HTML 断言脚本：`node artifacts/h10/probe.mjs <base> [--fixtures]`；退出码非 0 表示有断言失败 |
| `evidence-baseline.txt` | 迁移数据下的 73 项断言（含 404、语义结构、焦点、alt、图片不经优化器） |
| `evidence-fixtures.txt` | 装入 fixture 后的 91 项断言（分页/可见性/空状态/多页归档） |
| `fixtures.sql` / `cleanup.sql` | fixture 装载与清理；全部行以 `h10-` 前缀定位，跑完已删净（复核 `h10_posts=0, h10_albums=0, h10_tags=0`，无孤儿 `search_index` 行） |
| `screenshots/h10-archive.png` | 归档（真实数据，浅色） |
| `screenshots/h10-archive-mobile.png` | 归档 390px 宽（移动端） |
| `screenshots/h10-archive-mobile-dark.png` | 归档移动端 + 深色 |
| `screenshots/h10-taxonomy.png` | 分类与标签（浅色） |
| `screenshots/h10-taxonomy-light.png` | 同页浅色（与上一张同为浅色，保留为切换主题后的复拍） |
| `screenshots/h10-taxonomy-pagination.png` | fixture 下的 101 篇文章分页（第 1/6 页） |
| `screenshots/h10-empty-category.png` | 空分类的行动邀请文案 |
| `screenshots/h10-albums.png` | 相册列表（真实封面） |
| `screenshots/h10-album-detail.png` | 相册详情（22 张，多列瀑布流） |
| `screenshots/h10-album-detail-dark.png` | 相册详情深色 |
| `screenshots/h10-about.png` | 关于（资料卡 / 实时计数 / 站内导航 / 联系方式） |
| `screenshots/h10-cdn-image-direct.png` | 直接打开 CDN 原图，证明资源可达（与页面内败图无关） |

截图说明：Playwright MCP 的浏览器页签处于 hidden 状态，Chromium 对 `decoding="async"` 的懒加载图片不会完成绘制，所以截图前脚本把 `img.loading='eager'; img.decoding='sync'` 强制设了一次。这不是页面缺陷：在可见页签里图片正常懒加载（HTML 里 `src` 指向 CDN，DOM 中 `complete=true / naturalWidth=1920`）。

### 真实数据插入 / 清理

```powershell
Get-Content -Raw artifacts/h10/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h10/probe.mjs http://127.0.0.1:3320 --fixtures
Get-Content -Raw artifacts/h10/cleanup.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h10/probe.mjs http://127.0.0.1:3320
```

fixture 覆盖了三类真实数据到不了的状态：101 篇同分类文章（分页到第 6 页、第 7 页空态）、0 篇文章的分类/标签（空状态）、13 本无照片相册（列表分页 + 相册空态），外加 draft / unpublished / 无发布日期三种可见性。断言确认 draft 与 unpublished 不会出现在任何列表里，无日期文章进入「日期待定」。

## 门禁现状（2026-10-20 21:5x，共享工作树）

本任务开始时 `vp run ready` 因**其他任务在途文件**的格式问题失败（`apps/web/src/components/sheet.tsx`、`univer-canvas.tsx`、`scripts/migrate-content.ts`）。本任务文件本身 `vp check` 通过；全仓 `ready` 的最终结果记录在任务报告里（共享树上会被并行任务影响，不能据此判断本任务）。

## 已知边界 / 后续建议

1. **站点导航未改**：`nav-links.tsx` 不在本任务页面清单里，页脚/首页入口留给站点外壳任务。当前可达路径：任意页面页脚互链、`/about` 的「逛逛」区块覆盖全部新页面。
2. **`/rss.xml` 未实现**：`site_profile.social.rss` 指向站内 `/rss.xml`，本应用还没有该路由，所以 `/about` 只把绝对 URL 的社交项渲染成链接（相对路径项跳过），避免死链。等 feed 路由落地后放开即可。
3. **`favicon.ico` 404**：仓库本来就没有该文件，控制台会有一条 404，不属本任务。
4. **非 ASCII 参数**：Next 16 这里把路由参数以百分号编码传入（`%E5%AE%89%E5%85%A8`），页面在入口处 `decodeURIComponent` 后查库；已用「安全」分类实测 200。
5. **相册缩略图**：迁移数据里 `album_photos.thumb_key` 全为空，因此布局用 `image_key` 原图（最大 6400px）。等缩略图写入 `thumb_key` 后，`MediaImage` 会自动改用缩略图，无需改页面。
