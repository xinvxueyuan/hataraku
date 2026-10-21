# H62 数据库从零：单条 0000_init + 删除所有遗留

## 交付

- @@BT@@packages/db/src/migrations@@BT@@ 只剩 @@BT@@0000_init@@BT@@：按最终 schema 生成，删除 6 条历史迁移（含手写 @@BT@@search_index_fulltext@@BT@@ 与 @@BT@@two_factor_repair@@BT@@）。
- 删除 @@BT@@search_index@@BT@@ 全套：schema、relations、触发器/函数所在迁移、Orama 中「保留三步移除」注释、@@BT@@scripts/migrate-content.ts@@BT@@ 里的投影/检索验证。
- 删除 @@BT@@site_profile.nav@@BT@@、@@BT@@NavMeta@@BT@@、@@BT@@navMetaSchema@@BT@@、夹具 nav。
- 删除三处遗留 @@BT@@cover@@BT@@：@@BT@@posts.cover@@BT@@、@@BT@@projects.cover@@BT@@、@@BT@@albums.cover@@BT@@；删除 @@BT@@CoverMeta@@BT@@；API @@BT@@postSummary/project/album@@BT@@ schema 不再返回 @@BT@@cover@@BT@@；三处只保留 @@BT@@coverKey@@BT@@。
- 删除 @@BT@@scripts/check-compat.mjs@@BT@@ 中 @@BT@@A legacy cover object@@BT@@ 的 allow 条目（captain 授权）。
- 迁移 runner 改为按文件夹名记录 @@BT@@0000_init@@BT@@（Drizzle 1.0-rc 的 migrator 要求文件夹名前 14 位是时间戳，与 @@BT@@0000_init@@BT@@ 不兼容），见 @@BT@@packages/db/src/migrate.ts@@BT@@。
- 生产重建 runbook：@@BT@@artifacts/h62/PRODUCTION-REBUILD.md@@BT@@（含备份、列交集导出、认证保留、回滚）。

## 本地重建结果

本地 @@BT@@hataraku@@BT@@：drop → @@BT@@pnpm run db:migrate@@BT@@（@@BT@@0000_init@@BT@@）→ 恢复数据。

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
- @@BT@@search_index@@BT@@：@@BT@@to_regclass('public.search_index')@@BT@@ = NULL；旧表 39 行随重建移除。
- @@BT@@site_profile.nav@@BT@@ = 0 列；@@BT@@posts/projects/albums.cover@@BT@@ = 0 列。
- @@BT@@verification@@BT@@ / @@BT@@todos@@BT@@ / @@BT@@two_factor@@BT@@ 均保留。
- 迁移目录：只有 @@BT@@0000_init@@BT@@；@@BT@@drizzle.__drizzle_migrations@@BT@@ 记录 @@BT@@0000_init@@BT@@。
- @@BT@@pnpm run db:migrate@@BT@@ 二次执行幂等通过。

## 验收 grep

- @@BT@@rg -n 'search_index|ns_tsquery' -- packages apps scripts@@BT@@ = 0
- @@BT@@rg -n 'navMetaSchema|NavMeta' -- packages apps@@BT@@ = 0
- @@BT@@rg -n 'CoverMeta' packages apps@@BT@@ = 0
- @@BT@@rg -n 'cover: jsonb' packages/db/src@@BT@@ = 0
- @@BT@@rg -n 'legacy .cover' packages apps@@BT@@ = 0
- @@BT@@pnpm run check:compat@@BT@@ EXIT=0，输出中不再出现那条 allow。

## 测试与门禁

- @@BT@@vp test --project integration@@BT@@：186 passed（每个测试文件用 @@BT@@createTestDatabase@@BT@@ 从 @@BT@@0000_init@@BT@@ 建库）。
- @@BT@@vp test --project unit@@BT@@：82 passed。
- @@BT@@turbo run test:e2e@@BT@@：7 passed。
- @@BT@@pnpm --filter @hataraku/web build@@BT@@：成功（先清掉 H63 迁移留下的 stale @@BT@@.next@@BT@@；这是 frontend 在途生成的产物，不是 H62 代码）。
- @@BT@@pnpm run check:design@@BT@@、@@BT@@pnpm run check:compat@@BT@@、@@BT@@pnpm exec knip@@BT@@：EXIT=0。
- @@BT@@vp check apps packages scripts docs@@BT@@：267 files formatted、221 files lint/type 全绿。
- @@BT@@pnpm run ready@@BT@@ 未在共享树全绿：根目录未跟踪的 @@BT@@explore/@@BT@@ 会让全仓 @@BT@@vp check@@BT@@ 报格式问题，且 H63 正在搬路由；按共享树协议用上面的 scoped 验证。H63 完成后重跑 ready。
- 生产 runbook/彩排：@@BT@@PRODUCTION-REBUILD.md@@BT@@。

## 彩排摘要

- scratch 源（旧 6 迁移 + 旧数据，裁剪到 @@BT@@prod-baseline.json@@BT@@）→ scratch 目标（@@BT@@0000_init@@BT@@）。
- 先恢复 4 个列交集 CSV（albums/projects/posts/site_profile），再恢复 base data-only（含认证）；**不需要** @@BT@@session_replication_role@@BT@@，退出码 0。
- 目标计数与 @@BT@@prod-baseline.json@@BT@@ 一致（search_index 除外，已删）；38/7/96/122。
- 认证：user/account/session/two_factor = 1/1/2/1；密码 hash、2FA secret、backup codes md5 与源一致；@@BT@@verifyPassword@@BT@@ 原密码 true；Better Auth @@BT@@signInEmail@@BT@@ 返回 @@BT@@twoFactorRedirect: true@@BT@@。
- 完整命令与回滚方案见 @@BT@@PRODUCTION-REBUILD.md@@BT@@。

## 文件

- @@BT@@packages/db/src/migrations/0000_init/@@BT@@（新）
- @@BT@@packages/db/src/migrate.ts@@BT@@
- @@BT@@packages/db/src/schema/{posts,pages,json,content,media}.ts@@BT@@、@@BT@@relations.ts@@BT@@、删除 @@BT@@schema/search.ts@@BT@@
- @@BT@@packages/api/src/{schemas.ts,search/orama.ts,routers/{site,admin-posts,posts}.ts}@@BT@@
- @@BT@@packages/api/tests/{support/fixtures.ts,integration/{site,posts}.test.ts}@@BT@@
- @@BT@@scripts/migrate-content.ts@@BT@@、@@BT@@scripts/check-compat.mjs@@BT@@
- @@BT@@artifacts/h62/{before,after,rehearsal-*}.json@@BT@@、runbook、本文件
