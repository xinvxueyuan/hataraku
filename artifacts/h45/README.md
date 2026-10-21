# H45 · 把 OpenAPI 做成合格的外部契约

## 1. 结论

- 公开 spec 从 56 条收敛到 **22 条只读 GET**；后台、写接口、per-user 接口全部从公开文档消失（grep admin/todos/security/updateProfile/uploads/auth = 0 命中）。
- 稳定入口：`/api/openapi.json` 与 `/api/spec.json` **都 200 且字节完全相同**，`/api` 保留 Scalar 参考 UI。
- 元数据完整：`servers` 由配置推导（实测把 `BETTER_AUTH_URL` 配成 `https://hataraku.example`、请求走 localhost，spec 里是 `https://hataraku.example/api`），补了 `info.contact`/`license`、全局 tag 与每条 path 的 summary/tag。
- CORS 边界：公开只读端点允许任意源 GET/HEAD，预检只公布 `GET, HEAD, OPTIONS`；admin 写端点与 `/rpc` **不返回任何 CORS 头**。
- 站内新增 `/docs/api`（Velite docs），写明对外只读面、鉴权、curl、错误码与 CORS；明确「站内/手机端走 oRPC，第三方走 OpenAPI」，且不提供 oRPC 用法示例。
- 缓存：文档按 origin 进程内缓存一次；冷生成 47.7–115.1ms（dev 首次路由编译抖动），热 14.6–21.0ms。文档是代码/路由元数据产物，不依赖 DB 数据。

## 2. 对内 / 对外边界（用户明确）

```
web 应用（同源）      → oRPC（进程内 / 同源 /rpc）      ← 内部调用不变
手机端（第一方，未来）  → oRPC over HTTP（/rpc）          ← 保留可用，不开 CORS
第三方 / 外部消费者     → OpenAPI（/api/*，策展后的公开读）
```

- `/rpc` 未被修改、未被锁死：Web 端 `RPCLink` 指到 `\${origin}/rpc`（`apps/web/src/lib/api.ts`），手机端指到 `\${apiUrl}/rpc`（`apps/mobile/src/lib/api.ts`），catch-all 在 `apps/web/src/app/rpc/[[...rest]]/route.ts`。
- RPC 路径就是 router key 段：实测 `POST /rpc/posts/list`（body `{"json":{"page":1,"pageSize":1}}`）→ 200。之前测的 `/rpc/content.posts.list` 不是合法 key（posts 在顶层，不在 content 下），404 是正确行为。
- `/docs/api` 只描述 OpenAPI 面；oRPC 只作为「第一方通道」出现在边界表里，没有 RPC 用法/示例。

## 3. 策展清单（22 条）

| 路由 key | 方法 + 路径 | tag | summary |
| --- | --- | --- | --- |
| health | GET /health | 健康检查 | 服务健康检查 |
| posts.list | GET /posts | 文章 | 分页列出已发布文章 |
| posts.bySlug | GET /posts/{slug} | 文章 | 按 slug 读取一篇文章 |
| posts.adjacent | GET /posts/{slug}/adjacent | 文章 | 读取相邻文章 |
| posts.related | GET /posts/{slug}/related | 文章 | 读取相关文章 |
| taxonomy.categories | GET /taxonomy/categories | 分类与标签 | 列出分类及已发布文章数 |
| taxonomy.tags | GET /taxonomy/tags | 分类与标签 | 列出标签及已发布文章数 |
| taxonomy.overview | GET /taxonomy | 分类与标签 | 分类与标签总览 |
| search.query | GET /search | 搜索 | 全文搜索文章 |
| site.profile | GET /site | 站点 | 读取站点资料 |
| content.micro.list | GET /micro | 微言 | 分页列出微言 |
| content.projects.list | GET /projects | 项目 | 分页列出项目 |
| content.projects.bySlug | GET /projects/{slug} | 项目 | 按 slug 读取一个项目 |
| content.changelog.list | GET /changelog | 更新日志 | 分页列出更新日志 |
| content.friends.list | GET /friends | 友链 | 列出友链 |
| content.skills.list | GET /skills | 技能 | 列出技能 |
| content.tools.list | GET /tools | 工具 | 分页列出工具 |
| media.albums.list | GET /albums | 相册 | 分页列出相册 |
| media.albums.bySlug | GET /albums/{slug} | 相册 | 按 slug 读取相册与照片 |
| media.devices.list | GET /devices | 设备 | 分页列出设备 |
| media.diary.list | GET /diary | 日记 | 分页列出日记 |
| media.timeline.list | GET /timeline | 时间线 | 分页列出时间线 |

**排除**：所有 `adminProcedure`（posts/content 的 adminList、create、update、remove、publish、unpublish、byId、adminStats、uploads.policy/presign、site.updateProfile）、所有 `protectedProcedure`（security.overview、todos.*）、所有写接口（其中 content 写接口已按 301 行起）以及需要会话的读接口。它们仍可通过 RPC 内部使用，只是不属于对外契约。

**取舍理由**：外部消费者只读站点公开内容；把管理面列进公开文档会泄露后台能力与参数形状，也让「公开契约」失去可信边界。筛选用 allowlist（`packages/api/src/openapi-public.ts`），新增公开接口必须显式登记，错误地新增一个 publicProcedure 不会自动出现在 spec 或 CORS 白名单里。

## 4. 元数据

- `servers`：`[{ url: origin + "/api", description: "当前站点" }]`，origin 来自 `siteOrigin()`（配置 `BETTER_AUTH_URL` 优先，未配置时回退请求 host）。**没有写死域名**。
- `info`：title 夜行栈 API、description、contact（站点公开作者/邮箱）、version 0.0.0、license。仓库没有 LICENSE 文件，所以 license 写 **All rights reserved**，不冒充开源许可证；将来加正式许可证时替换。
- 每条 path 有 summary + tag；tag 有描述。`externalDocs` 指向本站 `/docs/api`。

## 5. 稳定路径与缓存

- `GET /api/openapi.json` 与 `GET /api/spec.json`：同一个进程内缓存的文档，直接 200 JSON，不 redirect；`/api` 的 Scalar UI 指向 `/api/openapi.json`。
- 缓存键是 origin（`Map<string, Promise<Document>>`）：配置了 `BETTER_AUTH_URL` 时只有一个条目；preview/本地按 host 分开。生成失败会从缓存移除，不会毒化后续请求。
- 失效方式：文档是代码与路由元数据的产物，不随数据库内容变化；部署启动新进程、dev HMR 重新加载模块即重建。没有 TTL，因为不需要——同一进程内 router 不会变。
- 实测：`GET /api/openapi.json` 冷 115.1ms / 热 21.0ms（另一次 47.7 / 14.6，dev 首次路由编译抖动）；字节 37247。

## 6. CORS 实测（Origin: https://example.com）

| 请求 | 状态 | access-control-allow-origin | 其他 |
| --- | --- | --- | --- |
| GET /api/posts | 200 | `*` | — |
| GET /api/posts/{slug} | 200 | `*` | — |
| GET /api/search?q=限流 | 200 | `*` | — |
| GET /api/openapi.json | 200 | `*` | cache-control: public, max-age=60 |
| OPTIONS /api/posts（预检 GET） | 204 | `*` | allow-methods: GET, HEAD, OPTIONS；allow-headers: Accept, Content-Type |
| POST /api/posts/adminList | 401 | **无** | 管理面不开放跨域 |
| OPTIONS /api/posts/adminList（预检 POST） | 404 | **无** | 写预检被拒绝 |
| POST /rpc/posts/list | 200 | **无** | 第一方通道不开放跨域 |
| POST /rpc/content.posts.list | 404 | **无** | 非法 RPC key |

安全边界写在 `openapi-public.ts` 与 `apps/web/src/server/api.ts` 注释里：wildcard origin 仅用于无凭证的公开读；预检不返回 `Access-Control-Allow-Credentials`；请求方法不是 GET/HEAD 的预检直接拒绝；`/api/auth`、admin、写接口和 `/rpc` 不在白名单。

## 7. 站内文档页

`apps/web/content/docs/api.md`（Velite docs，frontmatter title/description/section/order/updatedAt）：能调什么（22 条表）、基础地址、curl 示例、CORS、错误码（400/404/500，错误体含 code/message/status）、限流（公开 API 没有站点级限流；认证端点由 Better Auth 限流保护，不编造数值）、缓存与更新。实测 `/docs/api` 200，表格与代码块正常渲染。

## 8. 测试与门禁

- 新增 `packages/api/src/openapi-public.test.ts`（unit，27 个断言）：22 条策展、排除清单、route 元数据、tag 完整性、path 匹配、GET/HEAD/OPTIONS CORS、写预检拒绝。
- H45 的 13 个源码文件 `vp check`（fmt + lint + type）全绿。
- `NEXT_DIST_DIR=.next-h45-build pnpm --filter @hataraku/web build` → EXIT=0（共享 `.next` 一直被其他任务的 build 占用，所以用独立 dist 目录验证；产物已清理）。
- `vp test --project integration`：185 tests / 182 passed / 3 failed，失败全部来自 H44/H46 在途改动（posts fixture body 追加了测试字符串而 posts.test 未更新；site-profile 两个用例没有 H46 新要求的 `analytics` 字段），与 H45 无关；search 集成套件通过。
- 共享工作树里无法跑 repo 级 `pnpm run ready`（会把别人的半成品一起检查），按 captain 的协作协议改为「只检查自己的文件 + 隔离构建 + 说明原因」。

## 9. 变更文件

- `packages/api/src/openapi-public.ts`（新）：22 条公开契约、publicRoute、spec filter、CORS 白名单。
- `packages/api/src/index.ts`：导出上述契约。
- `packages/api/src/routers/{posts,taxonomy,site,search,content,media,health}.ts`：公开 procedure 加 GET 路径 + summary + tag。
- `packages/api/src/schemas.ts`：GET query 兼容（page/pageSize、limit、minCount 的 coerce；featuredOnly/highlightOnly 的 queryBoolean）。
- `apps/web/src/server/api.ts`：策展文档生成 + 进程内缓存 + `/api/openapi.json`/`/api/spec.json`/`/api` + 窄 CORS。
- `apps/web/src/app/api/[[...rest]]/route.ts`：导出 `OPTIONS`（否则 Next 自动 204，预检到不了处理器）。
- `apps/web/content/docs/api.md`：站内使用文档。
- `artifacts/h45/`：本报告、HTTP 探针与原始结果。

## 10. 已知边界

- 仓库没有 LICENSE，license 只能写 All rights reserved；有正式许可证后替换。
- `/api` 的 Scalar UI 从 CDN 加载脚本（与原参考 UI 相同的依赖）；无法离线渲染。
- 公开跨域是 `*` 且不带凭证；如果将来要开放带会话的接口，必须另建一个带 origin 白名单与 credentials 的策略，不能复用本模块。
- `tagSlugs` 这类数组查询参数在 GET 下用 bracket notation 传递（`tagSlugs[0]=a`），docs 只列字段名；需要时在规范文档里看 parameter schema。
- 文档页的示例是 curl；OpenAPI 文档本身没有逐 operation 的 request example（summary/tag/参数 schema 已有），示例集中在 `/docs/api`。
