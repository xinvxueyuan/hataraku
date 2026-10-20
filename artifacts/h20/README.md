# H20 — 安全概览页与 v2 旧文章地址

## 交付

| 位置 | 内容 |
| --- | --- |
| `packages/api/src/routers/security.ts` | `security.overview`（protected）与 `security.attempts`（admin） |
| `apps/web/src/app/settings/security/page.tsx` | 安全概览页：活跃会话、最近登录尝试、两步验证状态 |
| `apps/web/src/app/article/[slug]/page.tsx` | v2 文章地址的兼容段（308/307） |
| `packages/api/tests/integration/security.test.ts` | 越权隔离与摘要脱敏的集成测试（6 条） |
| `apps/web/src/app/login/page.tsx` | `redirectTargets` 增加 `/settings/security`（仓库既有约定） |
| `packages/api/src/index.ts` | 注册 `security` router（机械接线） |

页面是纯服务端渲染，没有客户端交互；所有链接都是相对路径，**没有任何硬编码域名或站点常量**。

## 越权边界：两种数据，两种可见性

**会话有 user 维度。** `security.overview` 是 `protectedProcedure`，查询里写死
`and(eq(session.userId, context.session.user.id), gt(session.expiresAt, now))`，且不接受任何 id
入参——没有可以指向别人的入口。当前会话由 `session.id` 与 `context.session.session.id` 比较标出。

**登录尝试没有 user 维度。** `login_attempts` 的列只有 `ip_hash`、`email_hash`、`outcome`、
`duration_ms`、`created_at`（见 `packages/db/src/schema/audit.ts`）。它是给限流用的部署级审计流水，
一行并不属于某个用户，也没有任何列能诚实地把一个用户和他的尝试对应起来。因此：

- `security.attempts` 走 `adminProcedure`：站长看部署级列表，普通登录用户得到 **FORBIDDEN**；
- 页面捕获 FORBIDDEN，展示解释文案而不是错误页；普通用户看到的第 2 张卡片只解释「登录尝试是部署级
  审计数据，只有站长可以查看」，并把上面的会话列表说明为他自己的登录记录。

这样普通用户永远拿不到别人的（乃至全局的）尝试数据，也拿不到别人的会话：浏览器实测里
`other@h20.test` 的页面不出现任何尝试行、不出现站长地址（见证据）。集成测试从 API 边界再验一遍。

**如果将来要「普通用户看自己的尝试」**，需要给 `login_attempts` 加 user 维度（或由写入方按用户落一份
可索引的引用），那是 schema 变更 + 写入方改动；本任务写范围不含 `packages/db/**`，故未做。

## IP 脱敏

- 数据库里本来就只有 HMAC 摘要：原始 IP 与邮箱不入库（schema 注释已写明）。
- API 只回传 **IP 摘要的前 12 个十六进制字符**，`email_hash` 一律不出服务端。
- 页面文案写明「数据库只保存 IP 与邮箱的 HMAC 摘要，原始地址不入库；这里显示 IP 摘要的前 12 位」。

12 位足以区分同一时刻的两条记录、辨认一段突发请求，又不构成可回查的标识。

## 登录尝试目前没有写入方（如实报告）

v3 里 `login_attempts` 只有表结构与迁移，**没有任何代码写它**：`grep loginAttempts` 只命中 schema、
迁移和 H13 的「故意不动这张表」记录。也就是说页面在该写入方落地之前会显示空态
（「还没有记录到登录尝试。」）。读路径、脱敏和鉴权都已就绪并有测试覆盖；写入方（在 Better Auth 的
登录路径上落审计行）属于另一个改动面，需要单独排期。

## v2 旧文章地址

v2 的文章详情是 `/article/<slug>`，v3 把 `/article` 改成了列表页、详情搬到 `/posts/<slug>`。

**为什么不是 `next.config` 的 `redirects()`。** 先说结论：配置层重定向在路由之前求值
（Next 16 文档 `dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`：
"Redirects are checked before the filesystem"），它无法询问「这个 slug 是否对应一篇已发布文章」，
而任务要求「目标文章不存在时跳到 `/article` 而不是死链」。两条要求合起来只能由一个知道答案的
路由段来满足，所以用 Next 16 文档允许的等价机制：`/article/[slug]` 服务端段里的
`permanentRedirect` / `redirect`（`dist/docs/01-app/02-guides/redirecting.md` 与
`04-functions/permanentRedirect.md`）。

- 已发布文章 → **308** `permanentRedirect("/posts/<slug>")`：这是规范地址的永久变更，308 保留请求
  方法（Next 用 307/308 而非 301/302 正是为了不把 POST 改成 GET），适合旧外链与搜索引擎换址。
- 未发布 / 不存在的 slug → **307** `redirect("/article")`：临时跳转。草稿以后可能发布，永久缓存
  「去列表」会活过那次状态变化；列表页本身仍是 200，没有被跳转吃掉。
- slug 可能以 percent-encoded 形式到达：同时用原值与 decode 后的值查询（并行两次，避免顺序重试
  翻倍延迟），跳转目标用数据库里真实的 `post.slug` 编码后拼接。

### v2 公开路径盘点（只读对照 `projects/nightstack/src/app`）

| v2 路径 | v3 状态 | 是否需要跳转 |
| --- | --- | --- |
| `/article/[slug]` | 详情搬到 `/posts/[slug]` | **需要**，已实现（308/307） |
| `/article` | 列表页 | 不需要（实测 200） |
| `/docs` | 列表页仍在（v3 另加 `/docs/[slug]`） | 不需要 |
| `/micro`、`/projects`、`/toolbox`、`/changelog` | H17 正在新建 | 按指示**不加**跳转 |
| `/albums`、`/albums/[slug]`、`/archive`、`/about`、`/search`、`/taxonomy`、`/taxonomy/[type]/[slug]` | 名称未变 | 不需要 |
| `/rss.xml`、`/atom.xml`、`/sitemap.xml`、`/llms.txt`、`/llms-full.txt`、`/robots.txt` | H15 已提供 | 不需要 |
| `/admin/**` | v2 的后台，非公开外链；v3 后台在 `/settings/admin/**`（H18 在改） | 不加猜测性跳转 |

因此 `apps/web/next.config.ts` 未改：需要兼容的唯一公开路径由上面的路由段承担。

## 写范围偏差（需追认）

| 文件 | 为什么必须 |
| --- | --- |
| `packages/api/src/index.ts` | router 不注册就不可达（机械接线，只加两行） |
| `apps/web/src/app/login/page.tsx` | 仓库约定：受保护页要加进 `redirectTargets`，否则登录后回不到本页 |
| `apps/web/src/app/article/[slug]/page.tsx` | 新增；唯一能同时满足「永久跳转」与「不存在回列表」的位置 |

未触碰 `apps/web/src/app/{micro,projects,toolbox,changelog,settings/admin}/**`。

## 证据

`artifacts/h20/verify-security.mjs` 用真实 Chromium 跑两个身份（站内白名单
`owner@h20.test` 与非白名单 `other@h20.test`，会话 cookie 在启用白名单前取得），**17/17 通过**：

- 匿名访问 `/settings/security` → `/login?redirect=%2Fsettings%2Fsecurity`；
- 站长：1 个活跃会话（标「当前」）、2 条尝试（密码错误 / 已发送 123 ms / IP 摘要 0123456789ab）、
  两步验证「未开启」且链接到 `/settings/two-factor`；
- 另一账号：只有自己的 1 个会话，**看不到任何尝试行**，看到解释文案，页面不出现站长地址；
- `/article/legacy-article` → 308 `/posts/legacy-article`；草稿与未知 slug → 307 `/article`；
  `/article` → 200；`/posts/legacy-article` → 200 且正文可见。

截图：`screenshots/owner-security.png`、`screenshots/other-security.png`、
`screenshots/anonymous-login.png`；结果：`verification.json`。

集成测试 `packages/api/tests/integration/security.test.ts`（6 条，全绿）覆盖：匿名调用两个 procedure
都 UNAUTHORIZED；两个账号的会话互不可见且当前会话标记正确；过期会话被排除；不在 `ADMIN_EMAILS`
的账号拿 FORBIDDEN；站长看到按时间倒序的尝试、摘要截断为 12 位且完整摘要与 `email_hash` 不出现在
返回里。

重现方式（临时 scratch 库，跑完即删）：

```sh
# 1. 建库并迁移（apps/web 目录，DATABASE_URL 来自 apps/server/.env）
node --input-type=module -e "import { createTestDatabase } from '@hataraku/db/testing'; ..."
# 2. 播种：artifacts/h20/seed.mjs（两篇文章 + 两条尝试）
# 3. 先在无 ADMIN_EMAILS 的 server 上跑 artifacts/h20/seed-sessions.mjs 取得两个会话 cookie
# 4. 以 ADMIN_EMAILS=owner@h20.test 启动 web，跑 artifacts/h20/verify-security.mjs
```
