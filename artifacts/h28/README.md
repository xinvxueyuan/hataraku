# H28：动态 OG 图 + /about 时间线 + /toolbox 友链

## ① `/api/og` 动态分享图

- Route Handler：`apps/web/src/app/api/og/route.tsx`，Node runtime，`next/og` 的 `ImageResponse`，固定 **1200×630**。
- 查询参数 `title` / `description` / `category` / `date` 全部可选：长度上限分别为 80 / 110 / 20 / 10；控制字符与 `<`、`>` 被替换，按 grapheme 截断；`date` 只接受 `YYYY-MM-DD`，其余情况忽略。缺省标题/描述回落到站点资料。
- 字体：**仓库内嵌的 Noto Sans SC 子集**（SIL OFL，GB 2312 + ASCII + 中文标点，6892 字，subset 后 1.59 MB）。以 base64 形式内嵌在 `og-font.ts`，运行时不再请求任何外部字体（v2 会依次尝试 CDN/jaDelivr，本实现刻意去掉这条路）。satori 只支持 ttf/otf/woff，且内置字体没有 CJK 字形——不内嵌字体中文标题就是空白框。重生成方法见 `artifacts/h28/make-font.py`。
- 视觉：暗底渐变 + 品红品牌块「夜」+ 标题卡 + 分类徽章 + 日期 + 请求 origin 的 host；host 由 `siteOrigin()` 推导，不写域名。
- 缓存头：`public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`。
- 文章页：`generateMetadata` 设置 `openGraph.images`（1200×630、alt、`/api/og?title=…&description=…&category=…&date=…` 的**绝对 URL**，由 `absoluteUrl(await siteOrigin(), …)` 生成），同时补齐 `openGraph.title/description/type/url`，避免页面级 openGraph 覆盖 layout 后丢字段。

## ② `/about` 时间线

- 数据：`media.timeline.list`，经 `loadAllRows` 拉全（上限 10 页）。
- 展示：`<ol data-slot="site-timeline">`，每条含日期（`YYYY-MM-DD` 经 `formatDisplayDate` 转中文长日期）、标题、`里程碑` 徽章（highlight）、分类徽章、描述、可选外链；左侧圆点 + 竖线。
- 空态：表 0 行时显示「时间线还没有记录……」邀请文案 + 去归档的链接（迁移时该表为 0 行，已实测空态）。

## ③ `/toolbox` 友链

- 数据：`content.friends.list`（该接口一次返回全部）。
- 展示：`<ul data-slot="friend-list">` 卡片，含头像（有 `avatarKey`/`avatarUrl` 用 `MediaImage`，否则首字占位）、名称、描述、标签、`访问站点` 外链（`rel=noopener noreferrer`）。
- 空态：0 行时显示「还没有友链……」邀请文案；页头计数追加「N 位朋友」。

## 验证

```powershell
node artifacts/h28/probe.mjs http://localhost:3302            # 空表基线
Get-Content -Raw artifacts/h28/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h28/probe.mjs http://localhost:3302 --fixtures # 有数据
Get-Content -Raw artifacts/h28/cleanup.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
```

- probe 覆盖：OG 200/PNG/1200×630/字节数、超长与含 `<script>` 的输入不崩、文章页 `og:image` 为绝对 URL 且能取回同尺寸 PNG；时间线与友链在 fixture/空表两态下的区块与文案。两轮全 PASS。
- 像素统计（Playwright + OffscreenCanvas，见 `evidence-og.txt`）：1200×630、85,835 bytes、423 个颜色桶、亮像素 22,525（2.98%）、luma 标准差 38.39 —— 非空白。
- 截图：`h28-about-empty.png`、`h28-about-filled.png`、`h28-toolbox-empty.png`、`h28-toolbox-filled.png`、`og.png`。
- fixture 已清理（`h28-%` 在 timeline_entries / friends 均为 0），清理后基线 probe 复跑 PASS。
- 门禁：`vp check`（含 fmt）4 个改动文件 0 error；`pnpm run ready` **EXIT=0**（typegen / vp check / knip / vp test / e2e / build，见 `evidence-ready.txt`；期间曾因 content 任务在途的 admin 测试 lint 短暂变红，其修复后复跑即绿）。

## 备注

- 3300 被其他任务的 preview server 占用，实测用 3302（未杀他人进程），完成后已停止并清理 `.next-test-3302`。
- 字体授权：Noto Sans SC 为 SIL OFL；`NotoSansSC-Og.otf` 是 subset 源文件，`og-font.ts` 是同数据的内嵌形式（二者一并入库，重新生成用 `make-font.py`）。
- 未改 `settings/**`、`sitemap.ts`/`llms*`/feed 端点。