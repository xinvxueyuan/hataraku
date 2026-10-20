# H17 补全 v2 缺失的四个公开页面

## 页面与数据

| 路由 | 取数 | 行为 |
| --- | --- | --- |
| `/micro` | `content.micro.list`（10 条/页） | 按发布时间倒序；正文 `whitespace-pre-line` 保留换行；类型徽章（随记/代码/对话/音乐/图片）；图片走 `MediaImage`（alt 带序号）；音乐曲目 + 外链；标签链到 `/taxonomy/tag/[slug]`；分页 |
| `/projects` | `content.projects.list`（12 条/页） | 封面卡片；`status` 映射进行中/筹备中/已归档（未知值原样显示）；精选徽章；标签；`link`/`repo` 去重后外链（rel=noopener）；分页 |
| `/toolbox` | `content.tools.list`（12 条/页）+ `media.devices.list`（100 条）+ `content.skills.list` | 工具卡片 + 分页；设备卡片（图片、分类、状态、规格 `specs`，`raw` 单键渲染为「规格」）；技能按分类分组；三段各自有行动邀请式空状态 |
| `/changelog` | `content.changelog.list`（10 条/页） | 版本号 + 日期 + 「重点版本」徽章；`changes` 列表，旧条目无 changes 时回退到 `bodyMd` 纯文本；分页 |

全部为 Server Component + `serverCall`（来源同 `archive`/`taxonomy`），复用 `components/pager.tsx`、`components/media-image.tsx`、`components/display-date.ts`（新增，日期列兼容 `Date` 与 `YYYY-MM-DD`）、`components/focus-ring.ts`（新增，统一可见焦点）。页面根节点是 `div`（`main` 由 layout 提供，保持单 `main`）；空状态均为「下一步去哪」的行动邀请文案。

## 域名约束

按「不得硬编码域名」要求：

- 页面、组件与端点**不包含任何站点域名或 CDN 域名**；绝对 URL 由 `components/site.ts` 的 `siteOrigin()` 在请求期推导（优先配置好的 `BETTER_AUTH_URL`，否则用请求的 `x-forwarded-host`/`host`），`metadataBase` 同样在 `generateMetadata` 中按请求推导。
- 资产地址只读 `R2_PUBLIC_BASE_URL`（`components/asset-url.ts`）；未配置时裸 key 没有地址，不会退回字面量域名。数据库里已存的绝对 `cover.src` 属于数据，原样透传。
- 本任务新增页面没有写入任何域名；fixture 的音乐外链使用占位域名 `example.org`（测试数据，不是产品配置）。

已同步修复消费者（提交 `293f098`）：`app/{rss.xml,atom.xml,sitemap.ts,llms.txt,llms-full.txt,robots.ts,layout.tsx}` 改为把 `await siteOrigin()` 传入 `absoluteUrl(origin, path)`，使 `site.ts` 的 origin 重构在 main 上成套生效。

## 验证

```powershell
Get-Content -Raw artifacts/h17/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h17/probe.mjs http://localhost:3300 --fixtures
Get-Content -Raw artifacts/h17/cleanup.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h17/probe.mjs http://localhost:3300
```

- 运行实例：本地 `3300`，数据库/凭据从 `apps/server/.env` 注入，另设 `BETTER_AUTH_URL=http://localhost:3300`（站点 origin）与 `R2_PUBLIC_BASE_URL`（资产 host，值只在环境里）。
- fixture：23 条微动态（含换行、图片、音乐、标签）、21 条更新日志（含重点版本与仅 body 的条目）、13 个工具、11 个额外项目（合计 13，触发第二页）。
- probe fixture 模式全 PASS：列表数量（10/12/14/10）、分页（1/3、1/2、1/3）、类型徽章、换行样式、图片 alt、音乐信息与收听链接、项目状态/精选/外链、设备规格、技能分组、重点版本、changes 列表、body 回退，以及四个 H15 端点仍用请求 origin 输出绝对 URL。
- probe 基线模式全 PASS：`/micro` 0 条碎片 + 邀请文案；`/changelog` 0 次版本记录 + 邀请文案；`/toolbox` 0 工具但设备/技能照常；`/projects` 2 个项目且无分页。
- 清理后复核：`h17-%` 在 micro_posts / changelog_entries / tools / projects 均为 0。
- `pnpm --filter @hataraku/web build`：✓ Compiled successfully，路由表包含 `/micro /projects /toolbox /changelog`；`grep SITE_URL apps/web/src` 为空。

### 证据

| 文件 | 内容 |
| --- | --- |
| `probe.mjs` | 页面/分页/空状态/端点 origin 断言 |
| `evidence-fixtures.txt` | fixture 模式完整输出（PASS） |
| `evidence-baseline.txt` | 迁移数据下的基线输出（PASS） |
| `evidence-build.txt` | web 生产构建输出 |
| `evidence-knip.txt` | knip 输出 |
| `evidence-ready.txt` | `pnpm run ready` 输出 |
| `screenshots/` | 四页 fixture 截图 + 空状态截图（micro/changelog/toolbox 基线） |

## 门禁现状（2026-10-21）

- 本任务文件 scoped `vp check`：全绿（4 页 + 2 组件）。
- `pnpm --filter @hataraku/web build`：通过。
- `pnpm run ready` 当前在 `vp check` 失败，命中的是**其他任务在途文件**：`AGENTS.md`、`CLAUDE.md`、`packages/api/tests/integration/admin-content.test.ts` 的格式问题；`vp run knip` 也只剩 `packages/api/src/r2.ts` 的 3 个未用导出（同属 admin 内容任务）。这些文件不在 H17 写范围（`packages/api/**`、根指令文件），未改动。

## 已知边界

- 四个页面没有加入 header/footer 导航：`layout.tsx` 与既有 footer 属于 H15 外壳，本任务写范围不含导航改造。需要入口时，建议由外壳任务把 micro/projects/toolbox/changelog 作为次级链接加入页脚。
- `/micro` 的图片同时支持 object key 与绝对 URL，取决于数据；绝对 URL 的域名属于数据，不随本次域名迁移自动更新。
