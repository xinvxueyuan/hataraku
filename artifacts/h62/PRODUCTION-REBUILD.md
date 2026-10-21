# 生产库重建 runbook（H62）

> 目标：把生产 schema 重建到单条 `0000_init`，恢复全部数据（内容 + 认证），验证后切换；旧库保留，可秒级回滚。
> 执行人：captain。本文不包含任何连接串、密码或密钥；所有 URL 由执行环境注入。
> 已批准顺序：先部署新代码 → CI 绿 → 部署 → 生产备份 → 重建 → 核对。新代码只读 `coverKey` 等现存列，在旧 schema 上安全。

## 0. 彩排结论（本地 scratch，不是生产）

- 内容：38 篇已发布 / 7 分类 / 96 标签 / 122 关联（96 是实测，早先的 98 是旧记忆，已确认）。
- 全表计数与 captain 的 `artifacts/h62/prod-baseline.json` 一致（search_index 除外，被删）。
- 认证：`user=1、account=1、session=2、two_factor=1、login_attempts=2`；密码 hash、2FA secret、backup codes 在恢复前后 md5 相同。
- 登录彩排：用原密码调用 Better Auth `signInEmail` 返回 `twoFactorRedirect: true`，2FA 记录仍在。
- 四张被删列的表用「列交集显式 COPY」导出，恢复时不报列不存在；base dump 不需要 `session_replication_role`。
- 失败时按第 8 节回滚；新库方案下旧库没有被修改，回滚只需切回连接串。

## 1. 前置检查 / 停止写入

1. 确认新代码已部署且线上页面正常（旧 schema）。
2. 公告维护窗口；停止写请求（至少停止后台/管理写入），保留只读或直接停应用。
3. 准备直连（非 pooler）连接串；psql/pg_dump 走 `sslmode=require`，不要走连接池。
4. 记录基线：执行第 5 节的计数 SQL，与 `artifacts/h62/prod-baseline.json` 对齐。
5. 在 Neon 控制台确认目标项目与分支；**不要**在本文命令里打印 URL。

建议变量（只在执行 shell 内）：

```bash
export PROD_OLD='postgresql://...:...@.../hataraku?sslmode=require'
export PROD_NEW='postgresql://...:...@.../hataraku_v2?sslmode=require'
export TS=$(date -u +%Y%m%dT%H%M%SZ)
```

## 2. 备份（先做，不可跳过）

### 2.1 全库自定义备份（回滚底牌）

```bash
pg_dump "$PROD_OLD" \
  --format=custom --no-owner --no-privileges \
  --file="hataraku-prod-$TS.dump"

pg_restore --list "hataraku-prod-$TS.dump" | head
sha256sum "hataraku-prod-$TS.dump" | tee "hataraku-prod-$TS.dump.sha256"
```

预期：dump 文件存在，list 能看到 `user`/`account`/`two_factor` 等表。保留 7 天。

### 2.2 可恢复的数据导出（重建用）

认证表（user/account/session/two_factor）**必须**在 base dump 里，不能只靠内容导入脚本。

```bash
pg_dump "$PROD_OLD" \
  --data-only --no-owner --no-privileges \
  --exclude-table=public.search_index \
  --exclude-table=public.posts \
  --exclude-table=public.projects \
  --exclude-table=public.albums \
  --exclude-table=public.site_profile \
  --exclude-table=drizzle.__drizzle_migrations \
  --file="hataraku-data-$TS.sql"

grep -c '^COPY public."user"' "hataraku-data-$TS.sql"
grep -c '^COPY public.account' "hataraku-data-$TS.sql"
grep -c '^COPY public.session' "hataraku-data-$TS.sql"
grep -c '^COPY public.two_factor' "hataraku-data-$TS.sql"
grep -c '^COPY public.posts' "hataraku-data-$TS.sql"   # 期望 0
```

### 2.3 四张被删列的表：显式列交集导出

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select body_md, category_id, category_slug, comment, cover_key, created_at, description, draft, featured, id, published, published_at, reading_minutes, slug, source_hash, source_path, title, updated_at, views from posts order by id) to 'posts-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select body_md, cover_key, created_at, description, featured, id, link, published, published_at, repo, slug, sort_order, source_hash, source_path, status, tags, title, updated_at from projects order by id) to 'projects-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select cover_key, created_at, date, description, id, published, published_at, slug, sort_order, source_hash, source_path, tags, title from albums order by id) to 'albums-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select analytics, author, avatar_key, avatar_url, description, email, hero, id, name, name_en, social, tagline, updated_at from site_profile order by id) to 'site-profile-$TS.csv' with (format csv, header true)"
```

预期行数：posts 39、projects 2、albums 1、site_profile 1（含 header，文件行数 = 行数 + 1）。四个文件必须与 base SQL 同一时间点导出。

## 3. 建新库并迁移到 0000_init（推荐）

不 drop 旧库。新建同项目数据库，保留旧库作为即时回滚。

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c 'CREATE DATABASE hataraku_v2'
DATABASE_URL="$PROD_NEW" pnpm run db:migrate
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c 'select name from drizzle.__drizzle_migrations order by id'
```

预期：`0000_init` 一行；迁移过程无错误。若报「database already exists」，说明新库名已被使用，换名或确认后清理，不要复用旧库。

## 4. 恢复（顺序不能变）

先恢复四张显式列的表，再恢复 base。这样 `album_photos.album_id` 的外键在 base 恢复时已经有 albums 行；posts 先于 post_tags 也没有问题。

```bash
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy albums (cover_key, created_at, date, description, id, published, published_at, slug, sort_order, source_hash, source_path, tags, title) from 'albums-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy projects (body_md, cover_key, created_at, description, featured, id, link, published, published_at, repo, slug, sort_order, source_hash, source_path, status, tags, title, updated_at) from 'projects-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy posts (body_md, category_id, category_slug, comment, cover_key, created_at, description, draft, featured, id, published, published_at, reading_minutes, slug, source_hash, source_path, title, updated_at, views) from 'posts-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy site_profile (analytics, author, avatar_key, avatar_url, description, email, hero, id, name, name_en, social, tagline, updated_at) from 'site-profile-$TS.csv' with (format csv, header true)"

psql "$PROD_NEW" -v ON_ERROR_STOP=1 -f "hataraku-data-$TS.sql"
```

预期：四个 COPY 分别 1/2/39/1 行；base 的 COPY 全部成功，包含 user/account/session/two_factor。**不要**加 `session_replication_role`；彩排已验证该顺序可恢复。若出现外键错误，停止并按第 8 节回滚，不要用禁用触发器掩盖。

## 5. 核对（必须全部通过才切换）

### 5.1 全表计数

```sql
select 'posts' as table_name, count(*)::int from posts
union all select 'categories', count(*)::int from categories
union all select 'tags', count(*)::int from tags
union all select 'post_tags', count(*)::int from post_tags
union all select 'projects', count(*)::int from projects
union all select 'albums', count(*)::int from albums
union all select 'album_photos', count(*)::int from album_photos
union all select 'skills', count(*)::int from skills
union all select 'devices', count(*)::int from devices
union all select 'site_profile', count(*)::int from site_profile
union all select 'user', count(*)::int from "user"
union all select 'account', count(*)::int from account
union all select 'session', count(*)::int from session
union all select 'two_factor', count(*)::int from two_factor
union all select 'login_attempts', count(*)::int from login_attempts
union all select 'todos', count(*)::int from todos
union all select 'verification', count(*)::int from verification
order by table_name;
```

对照 `prod-baseline.json`：posts 39、categories 7、tags 96、post_tags 122、projects 2、albums 1、album_photos 22、skills 5、devices 2、site_profile 1、user 1、account 1、session 2、two_factor 1、login_attempts 2；空表为 0。`search_index` 不再存在。

### 5.2 schema 检查

```sql
select coalesce(to_regclass('public.search_index')::text, 'NULL'); -- NULL
select count(*) from information_schema.columns
 where table_schema='public' and table_name='site_profile' and column_name='nav'; -- 0
select count(*) from information_schema.columns
 where table_schema='public' and table_name in ('posts','projects','albums') and column_name='cover'; -- 0
select count(*) from information_schema.tables
 where table_schema='public' and table_name in ('verification','todos','two_factor'); -- 3
```

### 5.3 认证数据

```sql
select count(*) from "user";
select count(*) from account;
select count(*) from session;
select count(*) from two_factor;
select md5(password) from account where provider_id = 'credential' limit 1;
select md5(secret), md5(backup_codes), verified from two_factor limit 1;
```

把密码 hash、secret、backup codes 的 md5 与备份时输出对比，必须相同。然后用**原密码**在登录页实测：先通过密码，再出现 2FA 验证码步骤；2FA 记录仍在。彩排中 Better Auth 返回 `twoFactorRedirect: true`。

## 6. 切换

1. 把部署环境的 `DATABASE_URL` 指向 `PROD_NEW`；
2. 重新部署/重启 server（连接池会重建）；
3. 实测：首页、文章、搜索、登录、后台保存、2FA；
4. 观察 5xx/登录失败/内容数；再决定是否关闭维护窗口。

旧库 `hataraku` 保持在线、只读或停写，保留至少 7 天；确认新库稳定后再清理。

## 7. 同库重建（仅当无法新建数据库）

只有在无法 `CREATE DATABASE` 时才用，风险更高：

1. 完成第 2 节全部备份并校验 sha256；
2. 停应用、终止连接：
```sql
select pg_terminate_backend(pid) from pg_stat_activity
 where datname = 'hataraku' and pid <> pg_backend_pid();
drop database hataraku with (force);
create database hataraku;
```
3. `DATABASE_URL="$PROD_OLD" pnpm run db:migrate`；
4. 按第 4 节恢复；按第 5 节核对；
5. 失败时按第 8.2 节用全库 custom dump 恢复旧 schema。

## 8. 回滚

### 8.1 新库方案（推荐路径）

旧库没有被修改：把 `DATABASE_URL` 切回 `PROD_OLD`，重启/部署，确认旧页面与登录正常。新库保留或删除均可。

### 8.2 同库方案

```bash
# 停应用后，重建空库（或删掉新 schema）
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c 'drop database hataraku with (force)'
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c 'create database hataraku'
pg_restore --no-owner --no-privileges --dbname="$PROD_OLD" "hataraku-prod-$TS.dump"
```

恢复后核对旧 schema：`search_index` 存在、`site_profile.nav` 存在、`posts.cover` 存在（旧库状态），线上页面恢复。

### 8.3 什么时候放弃重建

- 计数或 auth hash/2FA 任一不一致；
- 恢复出现外键/列错误且一次修正无效；
- 原密码无法登录，或 2FA 记录缺失；
- 切换后 5xx/登录失败持续；
- 维护窗口超时。立即回滚，不继续排查。

## 9. 彩排记录（scratch 库，可复跑）

- 源：旧 6 条迁移重建的 `hataraku_h62_src` + 旧数据；裁剪到生产基线（认证 1/1/2/1、login_attempts 2）。
- 目标：新 `0000_init` 的 `hataraku_h62_dst`。
- 导出：base data-only（含认证）+ 4 个列交集 CSV。
- 恢复：先 4 个 CSV（albums/projects/posts/site_profile），再 base SQL；无 `session_replication_role`，退出码 0。
- 计数对照（与 prod baseline 相同）：

| 表 | 基线 | 源（裁剪后） | 目标 |
| --- | --- | --- | --- |
| account | 1 | 1 | 1 |
| album_photos | 22 | 22 | 22 |
| albums | 1 | 1 | 1 |
| categories | 7 | 7 | 7 |
| login_attempts | 2 | 2 | 2 |
| post_tags | 122 | 122 | 122 |
| posts | 39 | 39 | 39 |
| projects | 2 | 2 | 2 |
| session | 2 | 2 | 2 |
| site_profile | 1 | 1 | 1 |
| skills | 5 | 5 | 5 |
| tags | 96 | 96 | 96 |
| two_factor | 1 | 1 | 1 |
| user | 1 | 1 | 1 |
| 其余空表 | 0 | 0 | 0 |
| search_index | 39（旧） | 0 | 不存在 |

- 内容：38/7/96/122。
- 认证：恢复后 `verifyPassword` 原密码 true、错误密码 false；Better Auth `signInEmail` 返回 `twoFactorRedirect: true`；2FA secret/backup codes md5 与源一致。
- 坑：
  - 旧 schema 源库回灌时，旧 `search_index` 触发器引用了已丢失的 `refresh_search_index`，需在**源库彩排**用 `SET session_replication_role = replica`；生产导出/新库恢复不需要这一步。
  - 不能整表 COPY 四张被删列的表；必须用上面的列交集。
  - 认证表不要交给内容导入脚本（`scripts/migrate-content.ts` 不覆盖 user/account/session/two_factor）。
