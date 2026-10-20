# H22 · v2 → v3 功能对账（只读审计）

> **审计快照**：hataraku `HEAD 91bc8d0`（H17 四个前台页 / H18 后台写路径 + R2 直传 / H20 安全页 / H21 登录审计 **均已提交**）+ 工作区仅剩导航重构等无关改动（见附录 B）；nightstack `HEAD 0bf88bf`（只读参考）。
> **方法**：逐文件阅读 + `grep` 结果 + 本地 `:3300` 实例的只读 HTTP 探针；所有结论都给出文件/行号/grep/探针句柄。**本任务除本文件外没有修改任何仓库文件**（不提交、不 push）。
> **图例**：✅ 已覆盖（等价或更强）｜🟡 有差异（可用但不等价）｜❌ 确认缺失（代码/grep 证明无实现）｜🚧 在途（仅在未提交工作区）｜❓ 无法确认（需产品/部署决策）

## 结论摘要

- **公开页面：v2 的 15 个公开 page 路由全部有 v3 对应**（含 `/article/[slug]` → `/posts/[slug]` + 308 别名）。页面内的能力有 5 处差异：首页信息密度、`/about` 时间线、`/toolbox` 友链、`/albums/[slug]` 灯箱、`/docs` 内容定位被替换。
- **API：`/api/og` 确认缺失**（v2 有 `next/og` ImageResponse，v3 探针 404）；upload / rss / atom / llms / llms-full / sitemap / robots 均有对应实现，但 **RSS/Atom 不再带正文、llms-full 由全文降为 800 字摘要**。
- **后台：四个写作面全部已提交**（posts 由 H14；micro / projects / changelog 与 R2 直传由 H18，提交 `805a071`），但 **文章编辑字段缺 分类/标签/封面/精选/评论开关/阅读时长/定时发布**，且 **`site_profile` 无任何写入方**、**无修改密码入口**、**后台无入口页**。
- **数据表：24 张。确认「无写入方」的内容表 4 张：`tags`、`categories`、`post_tags`、`site_profile`**；`verification` 无任何读写（Better Auth 未启用邮箱验证/重置）；`diary_entries`/`timeline_entries`/`friends` 只有 API 读、无页面消费（其中 timeline、friends 在 v2 有 UI）；`todos` 是 v3 脚手架遗留（v2 无此表）。
- **能力：搜索（中文 n-gram + AND/OR 两段）、时区（显式 Asia/Shanghai）、公开页分页 三项等价或更强；OG 图、脚本级运维（R2 CORS/校验）、文章写作字段三项确认缺失。**

## 对账主表

| 维度 | v2 实现 | v3 现状 | 结论 | 依据 / 证据 |
| --- | --- | --- | --- | --- |
| 页面 `/` | HeroSection + 公告条 + 最新 6 篇 + 功能入口 + 标签云 + Now 卡 + 状态条（`nightstack/src/app/page.tsx:82-195`） | 站点名/tagline/描述 + 最新 6 篇 + 分类入口（`hataraku/apps/web/src/app/page.tsx:39-138`），另有 API 状态胶囊 | 🟡 页面在，信息密度下降（无 Hero CTA / 功能入口 / 标签云 / Now） | 两侧 page.tsx 结构对照；v2 组件 `hero-section / announce-bar / now-card / tag-cloud` 在 v3 无对应 |
| 页面 `/article` | 服务端分页 10/页，`?page=N`（`nightstack/src/app/article/page.tsx:22,46-56`） | 分页 10/页 + URL 筛选 `category/tag`（`apps/web/src/app/article/page.tsx:68-169`） | ✅ 等价且更强（多筛选） | 两侧 page.tsx；v3 procedure `posts.list` 支持 `categorySlug/tagSlugs/orderBy`（`packages/api/src/routers/posts.ts:147-207`） |
| 页面 `/article/[slug]` | 详情页：TOC、相邻/相关文章、阅读时长、浏览量、JSON-LD、OG 元数据、KaTeX、shiki、评论占位（`nightstack/src/app/article/[slug]/page.tsx:24,37,96,113-120,253-300`） | 新地址 `/posts/[slug]`：标题/摘要/正文（MDX），无 TOC、无相邻/相关、无阅读时长/浏览量、无 JSON-LD、无 OG 图（`apps/web/src/app/posts/[slug]/page.tsx:39-77`）；旧地址 308 兼容（`apps/web/src/app/article/[slug]/page.tsx`，提交 7488c98） | 🟡 路由覆盖；详情页能力退化（API 已有 `posts.related`/`posts.adjacent` 但无页面消费） | v3 `posts.ts:72-105`（adjacent）、`:209-238`（related）；页面文件全文 79 行 |
| 页面 `/micro` | 固定 30 条、无分页；类型/图片/音乐/标签渲染（`nightstack/src/app/micro/page.tsx:49`） | H17 已恢复：10 条/页 + 分页、类型徽章、图片 `MediaImage`、音乐曲目+外链、标签链接（`artifacts/h17/README.md`；`apps/web/src/app/micro/page.tsx`） | ✅ 覆盖且更强（分页） | H17 提交 b262e99；probe 证据 `artifacts/h17/evidence-fixtures.txt` |
| 页面 `/projects` | 项目卡片 + 技能思维导图（`nightstack/src/app/projects/page.tsx`，`mindmap` 组件） | 项目卡片 + 状态/精选/标签/外链 + 分页；技能移到 `/toolbox`（`apps/web/src/app/projects/page.tsx:63-194`） | 🟡 项目覆盖；技能从 mindmap 变为 toolbox 列表（能力仍在，呈现变化） | v2 `mindmap.tsx` 只在 projects 使用；v3 `toolbox/page.tsx:222-226,298-335` |
| 页面 `/toolbox` | 工具 + **友链（友情链接表格）** + 技能（`nightstack/src/app/toolbox/page.tsx:8,41-48,115-117`） | 工具（分页）+ 设备 + 技能（`apps/web/src/app/toolbox/page.tsx:222-226`） | ❌ 友链 UI 缺失；设备已从 `/about` 移入并覆盖 | v3 `content.friends.list` 存在但**无任何页面调用**（grep `serverCall.content.friends` = 0） |
| 页面 `/changelog` | 固定 30 条、版本 + 重点 + 变更列表 + body 回退（`nightstack/src/app/changelog/page.tsx:31`） | H17 恢复：10 条/页 + 分页，版本/日期/重点徽章/changes/body 回退（`artifacts/h17/README.md`） | ✅ 覆盖且更强 | 同上 |
| 页面 `/albums`、`/albums/[slug]` | 相册列表固定 24 条；详情用 **LightboxGallery**（渐进增强，`nightstack/src/app/albums/[slug]/page.tsx:5,86-87`） | 相册列表分页；详情为瀑布列 + 缩略图 + 原图链接，无灯箱（`apps/web/src/app/albums/[slug]/page.tsx:131-162`） | 🟡 覆盖；灯箱交互缺失（P2） | 两侧详情页；v3 `MediaImage` 解析 key |
| 页面 `/archive` | 按年（`getFullYear`，服务器本地时区）+ 标签云 + 100 条上限（`nightstack/src/app/archive/page.tsx`） | 按年/月分组（显式 `Asia/Shanghai`）+ 年份跳转 + 未定日期分区 + 最多 1000 条（`apps/web/src/app/archive/page.tsx:25,97-135,185-318`） | ✅ 更强（时区正确、分区更细） | `archive/page.tsx:25` `SITE_TIME_ZONE` |
| 页面 `/taxonomy`、`/taxonomy/[type]/[slug]` | 分类/标签索引；详情各 50 条（`nightstack/src/app/taxonomy/[type]/[slug]/page.tsx:74,85`） | 分类/标签索引 + 计数；详情走 `posts.list` 筛选（`apps/web/src/app/taxonomy/[type]/[slug]/page.tsx`） | ✅ 覆盖 | 两侧 page.tsx + `taxonomy.overview/tags`（`packages/api/src/routers/taxonomy.ts:75-107`） |
| 页面 `/search` | 服务端搜索 + `?q` + `?page`（`nightstack/src/app/search/page.tsx:34-38`） | 服务端搜索 + `?q`，固定第 1 页 20 条（`apps/web/src/app/search/page.tsx:29`） | 🟡 搜索能力等价；**分页 UI 缺失** | v3 `search.query` 支持 page/pageSize，但页面只传 `page: 1` |
| 页面 `/docs` | 手写「设计系统 / 组件参考 / Markdown 管道 / 协议」长页（`nightstack/src/app/docs/page.tsx:32-33,139-257`） | Velite 驱动的实现文档列表 + `/docs/[slug]`，仅 3 篇（`apps/web/src/app/docs/page.tsx`；`apps/web/content/docs/*.md`：content-model / embedded-sheet / getting-started） | 🟡 路由覆盖；**内容定位被替换**，旧组件参考未迁移 | 两侧 docs 页面与 content 目录清单；是否有意未在仓库记录 → 见附录 C |
| 页面 `/about` | site_profile + 设备 + **时间线（20 条）** + 日历/日期计数（`nightstack/src/app/about/page.tsx:23,93-106`） | site_profile + 文章/分类/标签/相册计数 + 站点入口 + 社交链接（`apps/web/src/app/about/page.tsx:76-96`） | ❌ 时间线与日历缺失（设备移到 toolbox，仍覆盖） | v3 `about/page.tsx` 全文无 `timeline` 调用；`media.timeline.list` 无页面消费 |
| 页面（仅 v3） | — | `/login`、`/settings/{security,two-factor,admin/*}`、`/todos`、`/posts/[slug]` | ✅ v3 独有（登录/设置/todos 脚手架/新文章地址） | `apps/web/src/app` 目录清单 |
| API `/api/upload` | GET 策略 + POST 预签名（REST，`nightstack/src/app/api/upload/route.ts:29-85`；前端 `image-uploader / multi-image-uploader`） | `media.uploads.policy` / `media.uploads.presign`（oRPC，`packages/api/src/routers/media.ts:89-122` + `packages/api/src/r2.ts`；前端 `image-uploader.tsx`） | ✅ 能力等价（H18 提交 `805a071`）；**post 编辑器无封面上传**（见「文章编辑器字段」） | `r2.ts`/`slug.ts` 已在 HEAD；默认策略无 `configured` 字段（v2 有） |
| API `/api/og` | `next/og` ImageResponse 1200×630，字体缓存（`nightstack/src/app/api/og/route.tsx:341-352`），并接入 metadata（`nightstack/src/lib/seo.ts:47,87-100`） | **无此路由**；layout 的 `openGraph` 无 images（`apps/web/src/app/layout.tsx:40-47`） | ❌ 确认缺失 | 本地探针 `HEAD /api/og?title=x → 404`；v3 grep `api/og|opengraph|ImageResponse` 仅命中 layout/site.ts 的 locale，无图片生成 |
| API `/rss.xml`、`/atom.xml` | 有；item 带 `content:encoded` / `content` 正文，字段按 RSS2/Atom1.0 组织（`nightstack/src/app/rss.xml/route.ts:43-67`、`atom.xml/route.ts:42-68`） | 有；只输出 title/link/guid/pubDate/description/category，**无正文**（`apps/web/src/app/rss.xml/route.ts:67-89`、`atom.xml/route.ts:65-88`） | 🟡 端点覆盖；内容退化 | 对比两处 item 构造；v3 路由顶部注释称 per-request 渲染（`rss.xml/route.ts:18-23`） |
| API `/llms.txt`、`/llms-full.txt` | 有；llms.txt 列页面/分类/标签/最新文章/作品 + 机器端点（含 OG）；llms-full **文章正文原样输出**（`nightstack/src/app/llms-full.txt/route.ts:1-45`） | 有；llms.txt 页面清单缺 `/micro /projects /toolbox /changelog`（`apps/web/src/app/llms.txt/route.ts:26-55`）；llms-full 为 **800 字摘要**（`apps/web/src/app/llms-full.txt/route.ts:25,97`） | 🟡 端点覆盖；**页面清单过期 + 全文降摘要** | 两侧 route.ts；v3 `PAGES` 字面量对照 v2 的 `PAGES` |
| API `/sitemap.xml`、`/robots.txt` | 有；sitemap 含 `/micro /projects /toolbox /changelog` 与文章/分类/标签/相册（`nightstack/src/app/sitemap.ts`）；robots 禁 `/admin /api/ /search` | 有；sitemap 静态页只有 `/ /article /archive /taxonomy /albums /docs /about`（`apps/web/src/app/sitemap.ts:31-39`）；robots 禁 `/login /settings/ /todos`（`apps/web/src/app/robots.ts:15-18`） | 🟡 sitemap **漏 4 个已恢复页面**；robots 策略改变（/api /search 变为可抓） | 两侧文件；H17 恢复的 4 页未进 sitemap/llms 清单 |
| API `/admin/login/*`、`/admin/logout` | 自建登录/回调/登出路由（`nightstack/src/app/admin/login/callback/route.ts`、`admin/logout/route.ts`） | 由 Better Auth `/api/auth` 统一处理，经 `/api/[...rest]` 代理（`apps/web/src/app/api/[[...rest]]/route.ts`；`packages/auth/src/index.ts:66-138`） | ✅ 等价（实现机制更换） | 路由清单 + auth 配置（emailAndPassword / twoFactor / captcha / rateLimit） |
| API（仅 v3） | — | `/rpc/*`（oRPC）、`/api/*`（OpenAPI/health）、`/api/auth` | ✅ v3 独有 | `apps/web/src/app/rpc/[[...rest]]/route.ts`、`apps/server/src/app.ts` |
| 后台 posts 列表/新建/编辑 | 列表带 **状态筛选（all/published/draft）+ 搜索 q + 分页 20/页 + 批量删除**；新建 `/admin/posts/new`（`nightstack/src/app/admin/(dashboard)/posts/page.tsx:17-43,88-110,189-193`；`_lib/mutations.ts:377-380`） | 列表全量（无筛选/搜索/分页/批量）+ 每行发布/取消/删除；新建走 `/settings/admin/posts/new`（`apps/web/src/components/admin-post-list.tsx:32-113`；`apps/web/src/app/settings/admin/posts/page.tsx:42`；`posts/[id]/page.tsx:44`） | ✅ 新建/编辑/发布/删除齐（H18 `/new` 分支已提交）；**筛选/搜索/分页/批量缺失** | v3 `adminList` 无参数返回全部（`packages/api/src/routers/admin-posts.ts:97-106`） |
| 后台 micro 列表/编辑 | 列表/编辑；多图上传（`MultiImageUploader`）、slug、published/publishedAt（`nightstack/src/app/admin/(dashboard)/micro/micro-form.tsx:16,132`） | H18：列表 + 发布/撤下/删除 + 编辑器（内容/类型/标签/**单张图片**/日期）（`apps/web/src/components/micro-post-editor.tsx`，`micro-post-list.tsx`） | ✅ 覆盖（H18 提交）；**多图降为单图** | 编辑器 `post?.imageKeys[0]` 单值；API `microFields.imageKeys` 为数组但 UI 只传一项 |
| 后台 projects 列表/编辑 | 列表/编辑：封面、状态、排序、精选、link/repo、标签（`nightstack/src/app/admin/(dashboard)/projects`） | H18：列表 + 发布/撤下/删除 + 编辑器（封面、状态、排序、精选、link/repo、标签、Markdown）（`apps/web/src/components/project-editor.tsx`） | ✅ 覆盖（H18 提交 `805a071`） | 编辑器字段清单（`coverKey/featured/link/repo/sortOrder/status/tags`） |
| 后台 changelog | **无** | H18 新增：列表 + 新建/编辑/删除（`apps/web/src/components/changelog-editor.tsx`、`changelog-list.tsx`） | ✅ v3 独有增强（H18 提交 `805a071`） | HEAD 805a071 已含 `apps/web/src/app/settings/admin/changelog/` |
| 后台 site_profile 编辑 | `/admin/settings`：name/tagline/description/author/email/头像上传/社交/hero/now，保存后刷新整站缓存（`nightstack/src/app/admin/(dashboard)/settings/page.tsx:36-56,85-89`） | **无页面、无写入 procedure**；`site.profile` 只读（`packages/api/src/routers/site.ts:12-30`） | ❌ 确认缺失 | grep `siteProfile` 仅命中 site.ts（读）+ schema/relations；无 update/insert |
| 后台安全 | 修改密码（服务端策略 ≥16 + 弱口令 blocklist + 不得含邮箱）+ TOTP 注册/移除（`nightstack/src/app/admin/(dashboard)/security/page.tsx:61-67`；`security/actions.ts:29-53`） | 安全概览：自己的会话 + 部署级登录尝试 + 2FA 状态与开关（`apps/web/src/app/settings/security/page.tsx:58-188`）；2FA 注册/备份码/关闭（`apps/web/src/components/two-factor-setup.tsx`） | 🟡 2FA 更强；**修改密码入口缺失**、密码策略弱于 v2（Better Auth 默认） | v3 grep `changePassword|修改密码` = 0；auth 配置无 password 策略（`packages/auth/src/index.ts:85,116-131`） |
| 后台登录 / MFA | `/admin/login` + `/admin/login/mfa`（独立页） | `/login` 单页两步：密码 → 6 位 TOTP/备份码；可选 Turnstile（`apps/web/src/components/auth-form.tsx:124-215`；`turnstile-widget.tsx`） | ✅ 等价且更紧凑 | 两侧页面 + auth 插件配置 |
| 后台入口 / 仪表盘 | `/admin` → 302 `/admin/posts`（`nightstack/src/app/admin/(dashboard)/page.tsx:29-33`） | **无 `/settings/admin` 索引页**；后台页只在直链下可达，站点头部/用户菜单无后台入口（`apps/web/src/components/header.tsx`、`user-menu.tsx:44-68` 仅登录/2FA/登出） | ❌ 入口缺失（UX 级） | 本地探针 `/settings/admin → 404`、`/settings/admin/posts → 307 → /login`；目录无 `settings/admin/page.tsx` |
| 后台列表交互 | 状态筛选 + 搜索 + 分页 + 批量删除 | 无筛选/搜索/分页/批量（四个列表均全量渲染） | ❌ 确认缺失（P2） | `admin-post-list / micro-post-list / project-list / changelog-list` 全文 |
| 文章编辑器字段 | title、slug、分类、摘要、标签（自动建标签）、状态、发布时间、阅读时长、精选、评论开关、封面+alt、Markdown 正文（`nightstack/src/app/admin/(dashboard)/posts/post-form.tsx:16-25,164-209`） | title、slug、description、bodyMd + 发布/取消/删除（`apps/web/src/components/post-editor.tsx:44-89`；API `postFields` 只有 5 个字段，`packages/api/src/schemas.ts`）；无分类/标签/封面/精选/评论/阅读时长/发布时间 | ❌ 确认缺失（P0） | 两侧字段对照；`createPostInput/updatePostInput` 字段集 |
| 数据表 `tags` / `categories` / `post_tags` | v2 后台保存文章时自动建标签、重建 post_tags、分类下拉（`nightstack/src/app/admin/_lib/mutations.ts:6,66-101,195`） | 三张表**只有读**（posts/taxonomy 路由），无任何 insert/update/delete；文章编辑器也无法选分类/填标签 | ❌ 确认缺失（P0，与上一行同因） | grep `insert(tags)/insert(categories)/insert(postTags)/delete(postTags)` 于 `packages/api/src + apps/web/src` = 0；`postTags` 仅出现在 `posts.ts:39,169-171,223-224` 与 `taxonomy.ts:24` 的 SQL 读 |
| 数据表 `site_profile` | 后台设置页写单行（`id = 1`） | 只读（`site.profile`） | ❌ 确认缺失（P0） | 同「后台 site_profile 编辑」 |
| 数据表 `verification` | —（v2 无此表） | Better Auth schema 声明（`packages/db/src/schema/auth.ts:90`），全仓仅 schema + relations 两处引用；`createAuth` 未启用 `emailVerification`/密码重置（`packages/auth/src/index.ts:85-115`） | 🟡 无读写方（当前无流程使用；保留待将来启用） | grep `\bverification\b` 结果仅 3 行（schema/relations） |
| 数据表 `diary_entries` / `timeline_entries` | `diary`：v2 无页面/无编辑；`timeline`：v2 `/about` 渲染（20 条） | 二者只有 `media.diary.list` / `media.timeline.list` 读接口，**无页面消费**；无写路径 | 🟡 diary 与 v2 同为未用；timeline 属 v2 能力缺失（P2） | `packages/api/src/routers/media.ts:156-225`；v3 页面 grep `serverCall.media.timeline` = 0 |
| 数据表 `friends` | `/toolbox` 友情链接表格 | `content.friends.list` 存在（`packages/api/src/routers/content.ts:707-718`），**无页面消费** | ❌ UI 缺失（P2） | grep `serverCall.content.friends` = 0；v2 toolbox 对照 |
| 数据表 `todos` | 无此表 | v3 脚手架：`todos` 表 + `todos` router + `/todos` 页 + mobile 屏（`packages/api/src/routers/todos.ts`、`apps/web/src/app/todos/page.tsx`） | 🟡 v3 独有；与博客迁移无关，建议决定去留 | robots 亦禁 `/todos`（`robots.ts:16`） |
| 数据表 `login_attempts` | v2 写入方 + 限流（`src/db/queries/rate-limit.ts`） | 读：`security.attempts`（`packages/api/src/routers/security.ts:60-82`）；写：`withLoginAttempts` 包装 `auth.handler`（`packages/auth/src/login-attempts.ts`，HEAD 3c96f9b 已提交） | ✅ 读写齐（H21） | HEAD 提交 3c96f9b；集成测试 `login-attempts*.test.ts` |
| 能力 图片上传 | 浏览器直传 R2（预签名 PUT）+ 单图/多图上传组件 + `configure-r2-cors.ts` 与两个 CORS 校验脚本（`nightstack/scripts/`） | 同样预签名直传（`r2.ts`：MIME 白名单/10 MiB/前缀闭集/600s TTL）+ `image-uploader`；**无 CORS 配置/校验脚本**；H18 实测本地来源被桶 CORS 拒（`artifacts/h18/README.md:49-50`） | 🟡 上传实现等价；**部署前置（桶 CORS）无工具/清单**（P1） | 两侧上传实现；H18 README；脚本目录对照（v3 `scripts/` 仅 migrate-content） |
| 能力 草稿/发布流转 | posts 状态 draft/published + 发布时间；micro published；projects published | posts publish/unpublish + status；micro publish/unpublish；projects published 开关；changelog 无发布位（表本身无该列） | ✅ 覆盖 | 各 router procedures（`admin-posts.ts:146-207`、`content.ts`） |
| 能力 搜索 | 两段式：AND →（≤3 词时）OR 回退；CJK n-gram；ts_rank 排序（`nightstack/src/db/queries/posts.ts` searchPosts） | 同算法逐行移植（`packages/api/src/routers/search.ts:20-132`）+ H13 用 8 个中文前缀实测命中 | ✅ 等价（且 H13 已验证投影） | 两侧代码对照；`artifacts/h13/neon-hataraku.txt` |
| 能力 分页 | 文章 10/页；micro/changelog/albums 固定 30/24 无分页；taxonomy 详情 50 条 | 文章 10、micro/changelog 10、projects/toolbox 12、albums 12、archive 最多 1000 条；统一 `Pager` 组件（`apps/web/src/components/pager.tsx`） | ✅ 公开页更强（搜索页除外，见上） | 各页面 searchParams + `pagination.ts` |
| 能力 时区 | 日历组件显式 `Asia/Shanghai`；归档按服务器本地时区取年（`archive/page.tsx`） | 页面日期统一 `Intl` + `timeZone: Asia/Shanghai`（article:21-24、archive:25、about:23-26、security:32-36）；feed 注释明确 +08:00（`rss.xml/route.ts:18-20`） | ✅ 等价或更强 | 两侧时区代码 |
| 能力 缓存策略 | ISR：公开页 `revalidate` 300–3600s，feeds 1800，llms/sitemap 3600；另有 `purge-cdn-cache.ts` + 设置保存后刷新（`nightstack/src/app/**/page.tsx`） | feeds/llms/sitemap `force-dynamic` + `s-maxage=1800`；页面默认按请求渲染（无 `revalidate`）；无 CDN purge 脚本（`apps/web/src/app/{rss.xml,llms.txt,sitemap.ts}`） | 🟡 策略更换：正确性更稳、源站负载更高；是否有边缘缓存需部署确认 | grep `revalidate|force-dynamic` 两侧；见附录 C |
| 能力 Markdown 渲染 | GFM + KaTeX + 容器指令 + shiki + TOC + 标题降级 + 图片改写（`nightstack/src/lib/markdown/`；文章页 `:24,33`） | MDX + GFM + rehype-pretty-code(shiki) + slug/autolink；**无 KaTeX/数学、无容器指令、无 TOC 提取**（`apps/web/src/server/mdx.ts:74-83`） | 🟡 代码高亮/标题锚点覆盖；数学与指令语法丢失 | 两侧插件列表；v2 文章页 katex css 导入 |
| 能力 评论 | 占位组件「评论系统接入中」（`nightstack/src/components/nightstack/comment-section.tsx`） | 无 | ✅ 不需要迁移（v2 亦为占位） | 组件源码 |
| 能力 浏览量 | 列 `views` 有显示；`incrementViews` **只在测试里被调用**（`src/db/queries/__tests__/queries.test.ts:279`） | 列仍在；web 端无展示、无自增（grep `\bviews\b` 于 apps/web/src = 0） | 🟡 两边都不是真实能力；v3 少一个展示位 | 两侧 grep |
| 能力 密码策略 / 改密 | 服务端强制 ≥16 字符 + 弱口令 blocklist + 不得含邮箱（`src/lib/supabase/password-policy.ts`；`security/actions.ts:29-53`） | 无改密 UI；无自定义策略（Better Auth 默认，`packages/auth/src/index.ts`） | ❌ 确认缺失（P1） | v3 grep `changePassword` = 0；auth 配置无 `minPasswordLength` |
| 能力 2FA | TOTP 注册/移除（Supabase），MFA 登录页 | Better Auth twoFactor：注册（QR/密钥）+ 备份码 + 登录两步 + 关闭（`two-factor-setup.tsx`、`auth-form.tsx`） | ✅ 更强 | 组件 + auth 插件 |
| 能力 阅读体验组件 | 阅读进度条、键盘快捷键、公告条、浮动侧栏、返回顶部、主题英雄动画/切换、音乐播放器、思维导图、日历、灯箱、Docs 侧栏/TOC（`nightstack/src/components/nightstack/*`） | 仅主题切换（`mode-toggle.tsx`）与图片组件；其余未迁移 | 🟡 体验类差异（P2）；不阻塞内容 | 组件目录对照 + v2 组件→页面映射 |
| 运维脚本 | migrate-content、upload-assets、verify-migration、configure-r2-cors、verify-upload-cors、verify-upload-cors-browser、purge-cdn-cache（`nightstack/scripts/`） | 仅 `migrate-content.ts`（H13 重写）+ `tsconfig` | 🟡 一次性迁移脚本已被 H13 取代；**R2 CORS 两个脚本与 CDN purge 无对应**（CDN 因无 ISR 可不需要；CORS 必须补） | 两侧 scripts 目录清单；H13 README |

## 建议排期

### P0 — 阻塞内容运营 / 数据完整性（建议下一轮直接做）

1. **文章编辑字段 + 分类/标签写路径**：给 `postFields`/编辑器补 `categorySlug`、`tags`（自动建标签 + 重建 `post_tags`）、`coverKey`、`featured`、`comment`、`readingMinutes`、`publishedAt`。理由：没有写路径的 3 张表（`tags`/`categories`/`post_tags`）正好是分类页、标签页与 `search_index.tags` 的数据源；新文章现在无法进入分类/标签体系。依赖：`packages/api/src/schemas.ts`、`admin-posts.ts`、`post-editor.tsx`。
2. **site_profile 后台编辑**：新增 `site.update`（adminProcedure）+ 设置页（沿用 H18 的 admin shell / 上传组件）。理由：站点名称、简介、Hero、社交链接目前只能改库；H13 之后没有任何 UI 能改这些字段。

### P1 — 安全 / 分享 / 上传可用性 / SEO

3. **修改密码 + 密码策略**：Better Auth `changePassword` + 表单；策略对齐 v2（≥16 + blocklist + 不含邮箱）或明确记录新阈值。
4. **OG 图**：恢复 `/api/og`（或 `opengraph-image`）+ `metadata.openGraph.images`；v2 的 1200×630 卡片可直接移植。
5. **R2 桶 CORS**：补配置/校验脚本（或部署清单），把站点 origin 写进桶策略；H18 实测浏览器直传被拒。**这是上传功能在生产可用的前置条件。**
6. **sitemap / llms.txt 页面清单**：补 `/micro`、`/projects`、`/toolbox`、`/changelog`（H17 已上线但机器可读面仍缺）。顺带确认 robots 是否要恢复禁 `/search`。

### P2 — 体验 / 一致性（可排入常规迭代）

7. 后台列表：状态筛选、搜索、分页、批量删除（v2 有；当前全量渲染，数据量增长后会变慢）。
8. `/about` 时间线（`timeline_entries`）与日历/日期计数；`/toolbox` 友链（`friends` 读接口已就绪，仅缺 UI）。
9. 文章详情页：TOC、相关/相邻（API 已就绪）、阅读时长、JSON-LD。
10. 首页 Hero/功能入口/标签云：确认是「有意精简」还是补回。
11. `/docs` 内容定位：旧「组件参考/Markdown 管道」是否还需要（当前 3 篇实现文档替代）。
12. feed / llms-full 正文级内容（`content:encoded` / 全文）——取决于订阅方需求与带宽。
13. 相册灯箱、搜索分页、阅读进度条等体验组件（可选）。
14. 决策项：`verification` 表（是否启用邮箱验证/密码重置）、`todos` 脚手架是否移除、`diary_entries` 是否还要保留。

## 附录 A · 24 张表的读写方矩阵（grep 证据）

grep 范围：`hataraku/apps/**` + `hataraku/packages/**`（排除 `node_modules` / `migrations` / `dist` / `.next`），模式 `\.(from|insert|update|delete)\(<name>` / `db\.query\.<name>` / `Join\(<name>`。结果为**源文件**（不含测试）计数。

| 表 | 读 | 写 | 证据 |
| --- | --- | --- | --- |
| `posts` | ✅ posts.ts / search.ts（join）/ taxonomy.ts（join）/ admin-posts.ts | ✅ admin-posts.ts | 4 个消费方文件 |
| `search_index` | ✅ search.ts | ✅ DB 触发器（迁移 `20261020090000_search_index_fulltext`） | 应用层无写；H13 已验证 39/39 向量 |
| `categories` | ✅ posts.ts / taxonomy.ts | ❌ 无 | grep 写模式 = 0 |
| `tags` | ✅ posts.ts / taxonomy.ts | ❌ 无 | 同上 |
| `post_tags` | ✅ posts.ts（`:39,169-171,223-224`）/ taxonomy.ts（`:24`） | ❌ 无 | grep `insert/update/delete(postTags)` = 0 |
| `micro_posts` | ✅ content.ts | ✅ content.ts（H18 提交 `805a071`） | 公开 list 与 admin CRUD 均在 HEAD |
| `projects` | ✅ content.ts | ✅ content.ts（H18 提交） | 同上 |
| `changelog_entries` | ✅ content.ts | ✅ content.ts（H18 提交） | 同上 |
| `tools` | ✅ content.ts（`:670-703`） | ❌ 无（v2 亦无后台） | 只有 `tools.list` |
| `friends` | ✅ content.ts（`:707-718`） | ❌ 无（v2 亦无后台） | 无页面消费 |
| `skills` | ✅ content.ts（`:721-734`） | ❌ 无（v2 亦无后台） | 无写路径 |
| `albums` | ✅ media.ts（`:35-87`） | ❌ 无（v2 亦无后台） | 无写路径 |
| `album_photos` | ✅ media.ts（`:50-56`） | ❌ 无（v2 亦无后台） | 无写路径 |
| `devices` | ✅ media.ts（`:126-155`）、toolbox 页 | ❌ 无（v2 亦无后台） | 无写路径 |
| `diary_entries` | ✅ media.ts（`:156-195`） | ❌ 无（v2 亦无） | 无页面消费 |
| `timeline_entries` | ✅ media.ts（`:196-225`） | ❌ 无（v2 亦无） | 无页面消费（v2 about 有） |
| `site_profile` | ✅ site.ts | ❌ 无 | grep 仅读 |
| `login_attempts` | ✅ security.ts（`:60-82`） | ✅ auth/login-attempts.ts（HEAD 3c96f9b） | H21 已提交 + 集成测试 |
| `todos` | ✅ todos.ts / todos 页 / mobile | ✅ todos.ts | v3 独有 |
| `user` | ✅ Better Auth adapter + UI 会话 | ✅ Better Auth | `packages/auth/src/index.ts:66-73`（drizzleAdapter） |
| `session` | ✅ security.ts（`:90-103`）+ Better Auth | ✅ Better Auth | 同上 |
| `account` | ✅ Better Auth | ✅ Better Auth（email/password） | 同上 |
| `two_factor` | ✅ twoFactor 插件 | ✅ twoFactor 插件 | `packages/auth/src/index.ts:103-115` |
| `verification` | ❌ 无 | ❌ 无 | 全仓仅 schema/relations；未启用邮箱验证/重置 |

## 附录 B · 快照与在途改动（工作区）

- hataraku `HEAD 91bc8d0`；审计时已提交的相关任务：
  - H17 `b262e99`（/micro /projects /toolbox /changelog 四个前台页 + 机器端点 origin 修正 `293f098`）；
  - H18 `805a071`（micro / projects / changelog 写路径、`media.uploads.policy|presign`、R2 直传组件与集成测试；HEAD 的 `apps/web/src/app/settings/admin` 已含四个写作面）；
  - H20 `7488c98`（`/settings/security` + `/article/[slug]` 308 别名）；H21 `3c96f9b`（`login_attempts` 写入方）。
- 审计时工作区仍有**与本审计无关**的在途改动：`M apps/web/src/components/{header,nav-links,site-footer}.tsx`（导航「更多」折叠重构；未新增后台入口，见「后台入口」行），`?? artifacts/h23/`（他人任务产物）。本报告所有结论以 `HEAD 91bc8d0` 为准。
- 无 🚧 项剩余：H18 已落地，写作面与 R2 直传均为已提交状态。

## 附录 C · 无法确认 / 需决策

1. `/docs` 旧组件参考是否应保留：仓库无记录说明替换意图（❓）。
2. 缓存策略：v3 去掉 ISR 后是否需要部署层 CDN 缓存 `s-maxage` 之外的反向代理缓存——取决于部署拓扑（❓）。
3. R2 桶的**生产** CORS 是否已配置：仓库内无配置即代码，H18 只记录了本地来源被拒（❓）。
4. 生产是否仍需要 `/api/og` 这种动态图（分享卡片）——产品决策（❓）。
5. `timeline_entries` / `diary_entries` / `friends` 是否仍在产品范围内：H13 迁移对账时三表均为 0 行（见 `artifacts/h13/README.md` 的空表清单）；若确认不再需要，可直接删表并移除对应读接口，而不是补 UI（❓）。

## 附录 D · 复现命令（只读）

```sh
# 路由清单
Get-ChildItem -Recurse -File nightstack/src/app -Filter page.tsx
Get-ChildItem -Recurse -File hataraku/apps/web/src/app -Filter page.tsx
# 表读写方矩阵（示例：tags 写路径）
git -C hataraku grep -n "insert(tags)\|update(tags)\|delete(tags)" -- packages apps
# 探针（需本地 :3300 实例）
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3300/api/og?title=x
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3300/settings/admin
```