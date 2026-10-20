-- H30 fixtures: one post with a cover and one without, both h30- prefixed.
--   Get-Content -Raw artifacts/h30/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1

BEGIN;

DELETE FROM posts WHERE slug LIKE 'h30-%';

INSERT INTO posts (slug, title, description, body_md, published, draft, category_slug, cover_key, published_at, updated_at)
VALUES
  ('h30-cover-post', 'H30 有封面的文章', '这篇有封面，列表与详情都应出图。', E'## 正文\n\n封面测试。', true, false, 'frontend', 'albums/acg-example/1.webp', TIMESTAMPTZ '2026-10-21 06:00:00+08', TIMESTAMPTZ '2026-10-21 06:00:00+08'),
  ('h30-no-cover-post', 'H30 无封面的文章', '这篇没有封面，应显示固定比例占位而不是破图。', E'## 正文\n\n无封面测试。', true, false, 'frontend', NULL, TIMESTAMPTZ '2026-10-21 05:00:00+08', TIMESTAMPTZ '2026-10-21 05:00:00+08');

COMMIT;
