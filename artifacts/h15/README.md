# H15 机器端点与站点外壳

## 机器端点

| 端点 | Content-Type | 内容 |
| --- | --- | --- |
| `/rss.xml` | `application/rss+xml; charset=utf-8` | RSS 2.0，全部已发布且有发布时间的文章（标题 / 链接 / 摘要 / pubDate / 分类与标签） |
| `/atom.xml` | `application/atom+xml; charset=utf-8` | Atom 1.0，与 RSS 同源数据（id / published / updated / summary / category） |
| `/sitemap.xml` | `application/xml` | 7 个固定页 + 全部文章 + 7 个分类 + 96 个标签 + 1 本相册 |
| `/llms.txt` | `text/plain; charset=utf-8` | 站点概览、机器端点、页面目录、分类/标签、相册、全部文章清单 |
| `/llms-full.txt` | `text/plain; charset=utf-8` | 概览 + 每篇文章的元数据与**正文摘要**（Markdown 去掉语法后截取 800 字） |
| `/robots.txt` | `text/plain` | 允许抓取内容页；禁止 `/login`、`/settings/`、`/todos`；指向 sitemap |

时间语义统一为 `Asia/Shanghai`：RSS 用 RFC 822 `… +0800`，Atom 用 RFC 3339 `…+08:00`，与文章页显示一致。站点地址来自 `NEXT_PUBLIC_SITE_URL`（校验后只保留 origin），缺省回退 `https://www.xinvstar.xyz`。

数据全部经 `serverCall`：`posts.list` / `posts.bySlug`（正文摘要）/ `taxonomy.overview` / `media.albums.list` / `site.profile`。列表型 procedure 会分页，因此 `site-content.ts` 先拉全（每页 100、最多 10 页、按 id 去重）再输出；`/sitemap.xml` 设 `force-dynamic`，不会在 `next build` 时连数据库（构建输出里它是 `ƒ`，`/robots.txt` 是 `○`）。

## 站点外壳

- `layout.tsx`：统一 `Header` + `<main id="content">` + `SiteFooter`，最前面是「跳到正文」skip link；`<html lang="zh-CN">`。
- `header.tsx`：站名「夜行栈」链回首页；桌面端主导航（首页 / 文章 / 归档 / 分类 / 相册 / 关于 / 搜索）+ 登录状态 + 主题切换；窄屏折叠进 `<details><summary>菜单</summary>`（点击 / Enter / Space 展开，键盘可进入面板，不依赖 hover）。移动端导航与桌面端用不同 `aria-label`（主导航 / 主导航（移动））。
- `nav-links.tsx`：当前页 `aria-current="page"`（`/posts/*` 归到「文章」，`/taxonomy/*` 归到「分类」，`/albums/*` 归到「相册」）；所有链接带 `focus-visible:ring-*` 可见焦点。
- `site-footer.tsx`：站名与简介、页面导航、订阅与机器端点（RSS / Atom / Sitemap / llms.txt / llms-full.txt）。

## Metadata

- `layout.tsx` 设 `metadataBase`（来自 `SITE_URL`）、`title.default` + `title.template`（页面标题 →「归档 · 夜行栈」）、`description`、`openGraph`（title / description / url / siteName / locale / type）、`twitter`、`robots`、`alternates.canonical: "./"` 与 RSS/Atom 的 `alternates.types`。
- `canonical` 与 `og:url` 用相对 `"./"` 解析，**每个页面都是自己的绝对地址**（probe 逐页断言）。
- `openGraph.title` 是站点级（继承自 layout）；逐页 `og:title` 需要每个 `page.tsx` 自带 `openGraph`，不在本任务写范围，已在本报告注明。

## 验证

```powershell
node artifacts/h15/probe.mjs http://localhost:3300 38 38 7 96 1
```
（参数：base、已发布文章数、有发布时间的文章数、分类数、标签数、相册数，均来自 psql。）

结果：**PASS**，覆盖
- 三类 XML 的内容类型、命名空间、元素闭合、条目数 = 数据库行数（RSS item 38 / Atom entry 38 / sitemap url 149 = 7 + 38 + 7 + 96 + 1）、链接绝对地址、RFC 822 +0800 / RFC 3339 +08:00 时间格式；
- llms.txt 的文章/分类/标签/相册条目数与端点列表；llms-full.txt 每篇都有 URL 与「正文摘要：」；
- robots.txt 的 sitemap 与 Disallow；
- 10 个页面（含文章详情、分类详情、404 之外的页面）的 `lang`、title、description、og:title / og:description / og:url / og:site_name、canonical、feed alternate、skip link、`main#content`、桌面导航、移动折叠、页脚、机器端点链接、每页当前导航项（aria-current 指向正确 href，且 /docs 这类不在主导航的页面没有 aria-current）。

### 证据文件

| 文件 | 内容 |
| --- | --- |
| `probe.mjs` | 上述 HTML/XML 断言（退出码非 0 即失败） |
| `evidence-probe.txt` | probe 完整输出（PASS） |
| `evidence-curl.txt` | `curl -sS -D -` 的 6 个端点响应头（Content-Type 逐条）+ 条目计数 + psql 期望值 |
| `evidence-keyboard.txt` | 390×844 键盘走查：Tab 顺序（skip link → 夜行栈 → Sign in → 主题 → **菜单 summary** → 年份锚点 → 文章链接…）、Enter 展开 `<details>`、再 Tab 进入面板（首页→文章→归档→分类→相册）、Enter 激活「相册」后 URL 变为 `/albums` |
| `evidence-build.txt` | `vp run --filter @hataraku/web build` 输出：`/rss.xml` `/atom.xml` `/sitemap.xml` `/llms.txt` `/llms-full.txt` 均为 `ƒ` 动态路由 |
| `evidence-ready.txt` | `vp run ready` 完整输出（6/6 成功，EXIT=0） |
| `evidence-knip.txt` | `vp run knip` 无输出（干净） |
| `evidence-check-source.txt` | `vp check apps packages`：176 文件格式 + 141 文件 lint/type 全绿 |
| `screenshots/h15-desktop-shell.png` | 1280px 桌面：header 七项导航 + footer（页面导航与机器端点） |
| `screenshots/h15-mobile-shell.png` | 390px 移动端：站名 + 菜单按钮 |
| `screenshots/h15-mobile-menu.png` | 390px 展开菜单：当前项「归档」高亮 |

## 门禁

- 2026-10-21 00:53 在包含本任务全部改动的树上跑 `vp run ready`：**6/6 成功，EXIT=0**（typegen / vp check 192 文件 / knip / vp test 117 tests / e2e / build），完整输出见 `evidence-ready.txt`。
- 01:02 复跑确认时，`vp check` 仅因 `AGENTS.md`、`CLAUDE.md` 的格式问题失败；这两个文件是 GitNexus 集成写入的指令文件（不在本任务写范围），执行 `vp check --fix AGENTS.md CLAUDE.md` 即可恢复全绿。产品代码、测试与构建在 00:53 的运行里全部通过。
- `vp run knip`：干净（无输出）。
- GitNexus：提交前跑过 `detect_changes(scope: all)`（risk high；受影响流程是 RootLayout / Header / NavLinks 这类每个页面都会走的路径，已用 probe + 浏览器逐页验证）。随后索引被重建为不兼容的存储版本，MCP 报 "index was written by a different @ladybugdb/core build"，因此提交后无法再跑一次；未擅自 `analyze --force` 重建他人的索引。

## 本地运行说明

本次验证时，仓库已把 API 收进 web 进程（`apps/web/src/server/api.ts`，HEAD `3f1c147`），web 启动需要数据库与 Better Auth 变量。为避免改动任何 `.env` 文件，验证实例以 `apps/server/.env` 的值注入当前进程，然后：

```powershell
$env:PORT='3300'; $env:NEXT_PUBLIC_SITE_URL='http://localhost:3300'; $env:NEXT_DIST_DIR='.next-test-3300'
node node_modules/next/dist/bin/next dev --port 3300
```

喂入 `NEXT_PUBLIC_SITE_URL` 是为了让 feed / sitemap / canonical 在证据里都是 `http://localhost:3300` 的绝对 URL；生产不设则回退 `https://www.xinvstar.xyz`。

## 写范围

```
apps/web/src/app/layout.tsx
apps/web/src/app/rss.xml/route.ts
apps/web/src/app/atom.xml/route.ts
apps/web/src/app/sitemap.ts
apps/web/src/app/llms.txt/route.ts
apps/web/src/app/llms-full.txt/route.ts
apps/web/src/app/robots.ts
apps/web/src/components/site.ts          # 站点常量、转义、日期、纯文本摘要
apps/web/src/components/site-content.ts  # server-only 取数（分页拉全、去重）
apps/web/src/components/nav-links.tsx    # 主导航 + aria-current
apps/web/src/components/header.tsx       # 外壳 header（含移动折叠）
apps/web/src/components/site-footer.tsx  # 外壳 footer
artifacts/h15/**
```

未改动任何已交付页面的业务逻辑；页面只通过 layout 获得统一外壳和元数据。

## 已知边界

- **og:title 是站点级**：Next 的 metadata 只把 layout 的 `openGraph` 整体继承给未定义 `openGraph` 的页面，不会用页面 `title` 生成 `og:title`；逐页 `og:title` 需要每个页面自己写 `openGraph`（不在本任务写范围）。`og:url` / canonical 已逐页正确。
- **无发布时间的文章不进 feed**：RSS/Atom 的条目必须有时间；这类文章仍出现在归档、sitemap、llms 文件里。当前数据库没有这种文章（38/38 都有日期）。
- **/robots.txt 是构建期静态路由**：它只包含站点地址和固定规则，不读数据库；部署时若设置 `NEXT_PUBLIC_SITE_URL`，需在构建环境同样可用。
- 站点地址按 origin 处理：环境变量里带路径或结尾斜杠都会被归一化掉。
