# H62 数据库从零：单条 0000_init + 删除所有遗留

## 交付

- `packages/db/src/migrations` 只剩 `0000_init`：按最终 schema 生成，删除 6 条历史迁移（含手写 `search_index_fulltext` 与 `two_factor_repair`）。
- 删除 `search_index` 全套：schema、relations、触发器/函数所在迁移、Orama 中「保留三步移除」注释、`scripts/migrate-content.ts` 里的投影/检索验证。
- 删除 `site_profile.nav`、`NavMeta`、`navMetaSchema`、夹具 nav。
- 删除三处遗留 `cover`：`posts.cover`、`projects.cover`、`albums.cover`；删除 `CoverMeta`；API `postSummary/project/album` schema 不再返回 `cover`；三处只保留 `coverKey`。
- 删除 `scripts/check-compat.mjs` 中 `A legacy cover object` 的 allow 条目（captain 授权）。
- 迁移 runner 改为按文件夹名记录 `0000_init`（Drizzle 1.0-rc 的 migrator 要求文件夹名前 14 位是时间戳，与 `0000_init` 不兼容），见 `packages/db/src/migrate.ts`。
- 生产重建 runbook：`artifacts/h62/PRODUCTION-REBUILD.md`（含备份、列交集导出、认证保留、回滚）。

## 本地重建结果

本地 `hataraku`：drop → `pnpm run db:migrate`（`0000_init`）→ 恢复数据。

| 项目 | 改动前实测 | 重建后 |
| --- | --- | --- |
| 已发布文章 | 38 | 38 |
| 分类 | 7 | 7 |
| 标签 | 96 | 96 |
| post_tags | 122 | 122 |
| posts 总行 | 39 | 39 |
| user / account / session / two_factor | 49 / 49 / 45 / 1 | 49 / 49 / 45 / 1 |
| login_attempts | 33 | 33 |
| 其他表 | 原样 | 原样 |

- 任务书写的「98 标签」是旧记忆；改动前本地实测和恢复后都是 **96**，captain 已确认以实测为准。
- `search_index`：`to_regclass('public.search_index')` = NULL；旧表 39 行随重建移除。
- `site_profile.nav` = 0 列；`posts/projects/albums.cover` = 0 列。
- `verification` / `todos` / `two_factor` 均保留。
- 迁移目录：只有 `0000_init`；`drizzle.__drizzle_migrations` 记录 `0000_init`。
- `pnpm run db:migrate` 二次执行幂等通过。

## 验收 grep

- `rg -n 'search_index|ns_tsquery' -- packages apps scripts` = 0
- `rg -n 'navMetaSchema|NavMeta' -- packages apps` = 0
- `rg -n 'CoverMeta' packages apps` = 0
- `rg -n 'cover: jsonb' packages/db/src` = 0
- `rg -n 'legacy .cover' packages apps` = 0
- `pnpm run check:compat` EXIT=0，输出中不再出现那条 allow。

## 测试与门禁

- `vp test --project integration`：186 passed（每个测试文件用 `createTestDatabase` 从 `0000_init` 建库）。
- `vp test --project unit`：82 passed。
- `turbo run test:e2e`：7 passed。
- `pnpm --filter @hataraku/web build`：成功（先清掉 H63 迁移留下的 stale `.next`；这是 frontend 在途生成的产物，不是 H62 代码）。
- `pnpm run check:design`、`pnpm run check:compat`、`pnpm exec knip`：EXIT=0。
- `vp check apps packages scripts docs`：267 files formatted、221 files lint/type 全绿。
- `packages/api/tests/support/api.ts` 的 `afterAll(remove)` 改为 `afterAll(remove, 30_000)`：并行测试清理临时库偶尔超过 10s，ready 里曾出现 2 个 suite hook timeout。
- `pnpm run ready` 本地：268 tests、e2e 7/7 均通过；build 阶段被本地 stale `apps/web/.next/dev/types`（仍引用 H63 删除的旧路由）卡住，`pnpm --filter @hataraku/web build` 在清 `.next` 后成功，CI clean checkout 无此本地缓存。根目录未跟踪的 `explore/` 也会让全仓 `vp check` 报格式；因此按共享树协议用上面的 scoped 验证。
- 生产 runbook/彩排：`PRODUCTION-REBUILD.md`。

## 彩排摘要

- scratch 源（旧 6 迁移 + 旧数据，裁剪到 `prod-baseline.json`）→ scratch 目标（`0000_init`）。
- 先恢复 4 个列交集 CSV（albums/projects/posts/site_profile），再恢复 base data-only（含认证）；**不需要** `session_replication_role`，退出码 0。
- 目标计数与 `prod-baseline.json` 一致（search_index 除外，已删）；38/7/96/122。
- 认证：user/account/session/two_factor = 1/1/2/1；密码 hash、2FA secret、backup codes md5 与源一致；`verifyPassword` 原密码 true；Better Auth `signInEmail` 返回 `twoFactorRedirect: true`。
- 完整命令与回滚方案见 `PRODUCTION-REBUILD.md`。

## 文件

- `packages/db/src/migrations/0000_init/`（新）
- `packages/db/src/migrate.ts`
- `packages/db/src/schema/{posts,pages,json,content,media}.ts`、`relations.ts`、删除 `schema/search.ts`
- `packages/api/src/{schemas.ts,search/orama.ts,routers/{site,admin-posts,posts}.ts}`
- `packages/api/tests/{support/fixtures.ts,integration/{site,posts}.test.ts}`
- `scripts/migrate-content.ts`、`scripts/check-compat.mjs`
- `artifacts/h62/{before,after,rehearsal-*}.json`、runbook、本文件