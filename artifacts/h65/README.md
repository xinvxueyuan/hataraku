# H65 寻址模型

## 模型

- `posts.id` / `albums.id`：自增整数（identity）。
- `slug`：可空别名；`null` 表示无别名。
- `slug_only`：布尔，默认 false；为 true 时只允许通过 slug 访问，数字 id 一律 `NOT_FOUND`。
- 唯一性：部分唯一索引 `where slug is not null`，多行 null 可共存。
- 不变式：`not (slug_only and slug is null)`，DB check + zod 双重约束。
- 地址解析：`byRef({ segment })`，纯数字按 id、其它按 slug；API 不拼路由。

## 变更

- schema：`packages/db/src/schema/posts.ts`、`media.ts`、`taxonomy.ts`（post_tags.post_id 改 integer）。
- 一条 `0000_init`：删除旧目录重新 generate；仍只有这一条。
- API：`posts.bySlug` / `media.albums.bySlug` → `byRef`；`adjacent` / `related` 也改为 `segment`；OpenAPI 路由同步。
- 输出：`id`、`slug`（nullable）、`slugOnly`；搜索 hit 同步。
- 后台 posts 写入接受 `slug: string | null` 与 `slugOnly`；zod 校验 slug 形如 `[a-z0-9-]+`、长度上限，slugOnly 无 slug → 400；DB check 兜底。
- Orama：文档增加 `postId`（number）、`slug`、`slugOnly`；内部 `id` 仍用 string 满足 Orama。
- `scripts/migrate-content.ts`：复制后清空 posts/albums slug，并报告清空条数；`slug_only` 缺省 false。
- 生产 runbook：`artifacts/h65/PRODUCTION-REBUILD.md`（supersedes H62）。

## 本地重建

旧库（39 posts / 1 album / 122 post_tags / 22 album_photos / auth 49/49/45/1）：
- 旧 UUID → 新整数映射：posts 1..39、albums 1；post_tags/album_photos 外键同步改写。
- 清空 slug：posts 39 条、albums 1 条；地址全部变成 id 形式。
- 恢复后计数：38 已发布 / 7 分类 / 96 标签 / 122 post_tags；posts 39、albums 1、album_photos 22；auth 49/49/45/1；其他表不变。
- schema 检查：search_index NULL、nav 0、三处 cover 0、verification/todos/two_factor 3 张在、slug 全 null、slug_only 全 false、posts/albums 序列 setval 到 39/1。

## 测试

- integration：195 passed（byRef 数字/slug/不存在/旧 UUID/slugOnly 数字；slugOnly 无 slug DB 与 zod 双拒；多条 null slug；albums 数字/slugOnly；search 输出 id/slugOnly）。
- unit：82 passed。
- check:design / check:compat / knip：0。
- `vp check packages/db/src packages/api/src packages/api/tests scripts/migrate-content.ts`：59 files formatted / lint+type 全绿；见 backend-check.txt。
- `pnpm run db:migrate` 二次执行幂等。
- `pnpm run ready`（H66 `3a9e571` 已落地，从 `C:\dev\dsh\projects\hataraku` 执行）：
  - 直接跑：**EXIT=1**，唯一原因是仓库内未跟踪的 `explore/` 4 个文件（a/b/c.html、baseline-current-report.json）让 `vp check` 报格式化；不是代码错误。
  - 把这个仓库内 `explore/` 临时移出后：**EXIT=0**，282 files formatted、223 files lint/type 全绿，277 tests、e2e 7/7、build 成功。日志：ready-after-h66-plain.txt / ready-after-h66.txt。

## 彩排

- scratch 目标（`hataraku_h65_check`）用映射后的 CSV + base 恢复，计数与本地一致；auth 保留。
- 生产 runbook 的 4 张列交集 + projects/site_profile 旧列处理、认证 base dump、sequence setval 都已写入并演练（映射在本地真实数据上执行；旧 cover/nav 的列交集在 H62 彩排中已覆盖）。
- H65 的 `h65-check.json` / `h65-after.json` 保留计数证据。
