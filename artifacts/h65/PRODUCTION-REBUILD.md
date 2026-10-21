# H65 生产重建 runbook（寻址模型版，supersedes H62）

> 目标：新建 `hataraku_v2`，把生产从旧 schema 一次性重建到 `0000_init`；旧库保留，切换失败可秒回滚。
> 本版包含 H65 变更：`posts/albums.id` 改为自增整数、`slug` 可空、`slug_only`、部分唯一索引、check；**既有 slug 全部清空**。
> 仍由 captain 执行；不包含连接串/密码，Neon 零读取。

## 0. 彩排结论

- 本地真实数据：39 posts / 1 album / 122 post_tags / 22 album_photos；重建后 38/7/96/122 不变。
- 所有旧 slug 清空：posts 39 条、albums 1 条；地址变为 `/blog/<id>`、`/albums/<id>`。
- 新 id 为 1..39（posts）、1（albums）；post_tags/album_photos 已按映射改写。
- 认证：base dump 含 user/account/session/two_factor；本地重建后计数不变（49/49/45/1）。
- 迁移目录仍只有 `0000_init`；全新库 migrate 通过。
- 目标库验证：`search_index` NULL、`site_profile.nav` 0 列、`posts/projects/albums.cover` 0 列、`slug` 全 NULL、`slug_only` false。

## 1. 前置

1. 新代码（H65+H66）已部署且页面正常（旧 schema）。
2. 停写/维护窗口；用直连（非 pooler）连接串，`sslmode=require`。
3. 记录基线：posts 39、categories 7、tags 96、post_tags 122、projects 2、albums 1、album_photos 22、skills 5、devices 2、site_profile 1、user 1、account 1、session 2、two_factor 1、login_attempts 2；空表为 0。
4. 变量：

```bash
export PROD_OLD='postgresql://.../hataraku?sslmode=require'
export PROD_NEW='postgresql://.../hataraku_v2?sslmode=require'
export TS=$(date -u +%Y%m%dT%H%M%SZ)
```

## 2. 备份

```bash
pg_dump "$PROD_OLD" --format=custom --no-owner --no-privileges --file="hataraku-prod-$TS.dump"
pg_restore --list "hataraku-prod-$TS.dump" | head
sha256sum "hataraku-prod-$TS.dump" | tee "hataraku-prod-$TS.dump.sha256"
```

自定义备份是**回滚底牌**，保留 7 天。旧库不修改。

## 3. 数据导出（旧 UUID → 新整数 id）

### 3.1 建映射表

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS h65_post_map;
DROP TABLE IF EXISTS h65_album_map;
CREATE TABLE h65_post_map AS
  SELECT id AS old_id, row_number() OVER (ORDER BY published_at NULLS LAST, id)::int AS new_id FROM posts;
CREATE TABLE h65_album_map AS
  SELECT id AS old_id, row_number() OVER (ORDER BY date NULLS LAST, id)::int AS new_id FROM albums;
SQL
```

映射表在导出完就删除；它们不属于业务数据。

### 3.2 base dump（认证 + 未改列的表）

```bash
pg_dump "$PROD_OLD" --data-only --no-owner --no-privileges \
  --exclude-table=public.posts \
  --exclude-table=public.albums \
  --exclude-table=public.post_tags \
  --exclude-table=public.album_photos \
  --exclude-table=public.projects \
  --exclude-table=public.site_profile \
  --exclude-table=public.search_index \
  --exclude-table=drizzle.__drizzle_migrations \
  --exclude-table=public.h65_post_map \
  --exclude-table=public.h65_album_map \
  --file="hataraku-base-$TS.sql"

grep -c '^COPY public."user"' "hataraku-base-$TS.sql"
grep -c '^COPY public.account' "hataraku-base-$TS.sql"
grep -c '^COPY public.session' "hataraku-base-$TS.sql"
grep -c '^COPY public.two_factor' "hataraku-base-$TS.sql"
grep -c '^COPY public.posts' "hataraku-base-$TS.sql"   # 0
```

`site_profile` 被排除，因为旧库有 `nav`；`projects` 被排除，因为旧库有 `cover`；这两个与四张内容表一样用列交集导出。

### 3.3 五张列交集 CSV

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select p.body_md, p.category_id, p.category_slug, p.comment, p.cover_key, p.created_at, p.description, p.draft, p.featured, m.new_id as id, p.published, p.published_at, p.reading_minutes, null::text as slug, false as slug_only, p.source_hash, p.source_path, p.title, p.updated_at, p.views from posts p join h65_post_map m on m.old_id = p.id order by m.new_id) to 'posts-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select a.cover_key, a.created_at, a.date, a.description, m.new_id as id, a.published, a.published_at, null::text as slug, false as slug_only, a.sort_order, a.source_hash, a.source_path, a.tags, a.title from albums a join h65_album_map m on m.old_id = a.id order by m.new_id) to 'albums-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select m.new_id as post_id, pt.tag_id from post_tags pt join h65_post_map m on m.old_id = pt.post_id order by m.new_id, pt.tag_id) to 'post-tags-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select m.new_id as album_id, ap.created_at, ap.description, ap.height, ap.id, ap.image_key, ap.slug, ap.sort_order, ap.taken_at, ap.thumb_key, ap.title, ap.width from album_photos ap join h65_album_map m on m.old_id = ap.album_id order by m.new_id, ap.sort_order, ap.id) to 'album-photos-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select body_md, cover_key, created_at, description, featured, id, link, published, published_at, repo, slug, sort_order, source_hash, source_path, status, tags, title, updated_at from projects order by id) to 'projects-$TS.csv' with (format csv, header true)"

psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c "\copy (select analytics, author, avatar_key, avatar_url, description, email, hero, id, name, name_en, social, tagline, updated_at from site_profile order by id) to 'site-profile-$TS.csv' with (format csv, header true)"
```

预期：posts 39、albums 1、post_tags 122、album_photos 22、projects 2、site_profile 1（行数另行用 SQL 核对）。清空别名数：`select count(*) from posts where slug is not null` 与 albums 同。

### 3.4 删除映射表

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c 'DROP TABLE h65_post_map; DROP TABLE h65_album_map;'
```

## 4. 建新库并迁移

```bash
psql "$PROD_OLD" -v ON_ERROR_STOP=1 -c 'CREATE DATABASE hataraku_v2'
export DATABASE_URL="$PROD_NEW"
export BETTER_AUTH_SECRET="<existing production value>"
export BETTER_AUTH_URL="<existing production origin>"
pnpm run db:migrate
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c 'select name from drizzle.__drizzle_migrations'
```

预期 `0000_init` 一行。迁移目录只保留 `0000_init`。

## 5. 恢复

顺序：base（认证/分类/标签/其他）→ assets（posts/albums/projects/site_profile）→ links（post_tags/album_photos）→ setval。

```bash
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -f "hataraku-base-$TS.sql"

psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy posts (body_md, category_id, category_slug, comment, cover_key, created_at, description, draft, featured, id, published, published_at, reading_minutes, slug, slug_only, source_hash, source_path, title, updated_at, views) from 'posts-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy albums (cover_key, created_at, date, description, id, published, published_at, slug, slug_only, sort_order, source_hash, source_path, tags, title) from 'albums-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy projects (body_md, cover_key, created_at, description, featured, id, link, published, published_at, repo, slug, sort_order, source_hash, source_path, status, tags, title, updated_at) from 'projects-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy site_profile (analytics, author, avatar_key, avatar_url, description, email, hero, id, name, name_en, social, tagline, updated_at) from 'site-profile-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy post_tags (post_id, tag_id) from 'post-tags-$TS.csv' with (format csv, header true)"
psql "$PROD_NEW" -v ON_ERROR_STOP=1 -c "\copy album_photos (album_id, created_at, description, height, id, image_key, slug, sort_order, taken_at, thumb_key, title, width) from 'album-photos-$TS.csv' with (format csv, header true)"

psql "$PROD_NEW" -v ON_ERROR_STOP=1 <<'SQL'
SELECT setval(pg_get_serial_sequence('posts','id'), (SELECT max(id) FROM posts));
SELECT setval(pg_get_serial_sequence('albums','id'), (SELECT max(id) FROM albums));
SQL
```

不要用 `session_replication_role` 掩盖外键错误；彩排不需要。

## 6. 核对

```sql
select 'posts', count(*) from posts
union all select 'categories', count(*) from categories
union all select 'tags', count(*) from tags
union all select 'post_tags', count(*) from post_tags
union all select 'projects', count(*) from projects
union all select 'albums', count(*) from albums
union all select 'album_photos', count(*) from album_photos
union all select 'user', count(*) from "user"
union all select 'account', count(*) from account
union all select 'session', count(*) from session
union all select 'two_factor', count(*) from two_factor
order by 1;

select count(*) from posts where slug is not null;      -- 0
select count(*) from albums where slug is not null;     -- 0
select count(*) from posts where slug_only;             -- 0
select min(id), max(id) from posts;                     -- 1, 39
select relname from pg_class where relname in ('posts_slug_key','albums_slug_key');
```

认证：`select md5(password) from account where provider_id='credential'`、`select md5(secret), md5(backup_codes), verified from two_factor` 与备份前一致；用原密码登录，确认 2FA 提示。彩排结果：verifyPassword true、Better Auth `signInEmail` 返回 `twoFactorRedirect:true`。

### 6.1 地址回归（旧 UUID 必须 404，新整数必须 200）

在 3.1 建映射后、删除映射前记录一对样本：

```sql
select old_id, new_id from h65_post_map order by new_id limit 1;
select old_id, new_id from h65_album_map order by new_id limit 1;
```

把 old_id 记为 OLD_POST_UUID / OLD_ALBUM_UUID，new_id 记为 NEW_POST_ID / NEW_ALBUM_ID。切换后执行：

```bash
SITE='https://<production-origin>'

# 新整数地址必须能打开
curl -s -o /dev/null -w 'new post: %{http_code}\n' "$SITE/blog/$NEW_POST_ID"
curl -s -o /dev/null -w 'new album: %{http_code}\n' "$SITE/albums/$NEW_ALBUM_ID"

# 旧 UUID 地址必须 404；不要加 redirect/alias
curl -s -o /dev/null -w 'old post uuid: %{http_code}\n' "$SITE/blog/$OLD_POST_UUID"
curl -s -o /dev/null -w 'old album uuid: %{http_code}\n' "$SITE/albums/$OLD_ALBUM_UUID"

# 清空后的旧 slug 也必须 404
curl -s -o /dev/null -w 'old post slug: %{http_code}\n' "$SITE/blog/<old-slug>"
```

预期：新整数 200；旧 UUID 与旧 slug 404（页面的 404 状态，不是 200 的空壳）。若旧 UUID 返回 200，说明还有 slug/redirect 兼容路径，停止切换并按回滚处理。

## 7. 切换 / 回滚

- 切换：`DATABASE_URL` 指向 `PROD_NEW`，重启 server，smoke 首页/文章/相册/搜索/登录/2FA。
- 回滚（推荐路径）：切回 `PROD_OLD` 并重启；旧库从未修改。新库可删。
- 同库回滚：停应用，drop/create，`pg_restore --no-owner --no-privileges --dbname="$PROD_OLD" "hataraku-prod-$TS.dump"`。
- 放弃条件：计数/认证 hash/2FA 不一致，原密码登录失败，恢复列错误，5xx 持续，维护窗口超时。

## 8. 已踩的坑

- 不能直接 COPY 旧表：id 类型从 uuid 变 integer；必须建映射并重写 post_tags/album_photos 的外键列。
- 旧库有 `posts/projects/albums.cover`、`site_profile.nav`；这四类表不能用整表 COPY，必须列交集。
- 认证表必须留在 base dump，不能用内容导入脚本替代。
- 四张表/两张关联表必须在 base 之后恢复；album_photos 在 albums 之后。
- identity 列显式 COPY 后要 setval，否则新插入会撞 id。
- 旧库 search_index 必须排除；新库不存在。
