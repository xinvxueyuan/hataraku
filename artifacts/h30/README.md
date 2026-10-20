# H30：前台渲染文章封面

## 改动

| 位置 | 改动 |
| --- | --- |
| `components/post-cover.tsx`（新） | 固定宽高比容器 + 首字占位 + `MediaImage`；封面缺失时不留空、不破图 |
| `components/media-image.tsx` | 新增可选 `sizes`，`fill` 分支透传给 next/image（默认值不变） |
| `app/page.tsx` | 首页「最新文章」行卡左侧缩略图（16:9，160/112px） |
| `app/article/page.tsx` | 列表项左侧缩略图 |
| `app/taxonomy/[type]/[slug]/page.tsx` | 列表项左侧缩略图 |
| `app/posts/[slug]/page.tsx` | 正文顶部 2:1 封面（768px/100vw） |
| `app/layout.tsx` | 站点级默认 `openGraph.images`（`/api/og` + 站点名/tagline），twitter 改 `summary_large_image`；页面级 openGraph 仍覆盖 |
| `vite.config.ts` | `shadcn/no-inline-styles` 从 OG route 的文件级 disable 移入 `lint.overrides`（`apps/web/src/app/api/og/**`），注明 satori 不读 CSS |

## 实现要点

- **统一卡片**：`PostCover` 用 `aspect-video`（列表）或 `aspect-[2/1]`（详情）固定容器；占位层是标题首字（跳过标点）+ muted 渐变，图片以 `fill` 覆盖其上。无封面时占位可见，有封面时图片覆盖，两种情况容器尺寸一致 → 不跳布局。
- **alt**：始终用文章标题；有 `cover.alt` 时也可传入，当前用标题。
- **不绕过 MediaImage**：所有封面都走既有 `MediaImage`（内部 `assetUrl` + `unoptimized`），未写裸 `<img>`。
- **sizes**：列表 `(min-width:640px) 160px, 112px`，详情 `(min-width:768px) 768px, 100vw`。对象经 CDN、未配 `images.remotePatterns`，所以 MediaImage 保持 `unoptimized`——Next 不输出 srcset，DOM 里没有 sizes 属性；CLS 由固定宽高比容器兜底。
- **默认 OG**：layout 的 `generateMetadata` 生成 `/api/og?title=<站点名>&description=<tagline>` 绝对 URL；文章页自带 openGraph.images 时以页面为准（实测首页/关于一致、文章页不同）。

## 验证

```powershell
Get-Content -Raw artifacts/h30/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
# Playwright: 首页/文章/分类/详情 两种文章的 frame 与 naturalWidth 断言 + 截图
Get-Content -Raw artifacts/h30/cleanup.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
```

- 真机测量见 `evidence.txt`：三个列表页封面 `naturalWidth=1920`、alt 正确；无封面卡片无 `<img>` 且 frame 尺寸与有封面一致；详情页 592×296 同上。
- 截图：`h30-home.png`、`h30-article.png`、`h30-taxonomy.png`、`h30-detail-cover.png`、`h30-detail-no-cover.png`。
- 站点默认 OG：首页/关于继承、文章页覆盖；首页 OG 实取 200 image/png 1200×630。
- fixture 已清理（`h30-%` 在 posts 为 0），清理后行数回到基线。
- 门禁：`vp check`（含 fmt）9 个改动文件 0 error；`pnpm run ready` **EXIT=0**（见 `evidence-ready.txt`）。

## 备注

- 3300 被其他任务占用，实测用 3302；完成后已停止并清理 `.next-test-3302`。
- 未改 `settings/**`、`sitemap.ts`/`llms*`/feed/`api/og` 逻辑（仅把 OG 的 lint 例外移入 config）。
