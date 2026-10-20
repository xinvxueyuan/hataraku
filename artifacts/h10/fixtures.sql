-- H10 archive / taxonomy / albums fixtures.
--
-- Distinctive `h10-` slugs keep every row this script writes addressable for cleanup, so the
-- verification never touches migrated content. Run against the local dev database:
--   docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1 < artifacts/h10/fixtures.sql

BEGIN;

DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE slug LIKE 'h10-%');
DELETE FROM posts WHERE slug LIKE 'h10-%';
DELETE FROM tags WHERE slug LIKE 'h10-%';
DELETE FROM categories WHERE slug LIKE 'h10-%';
DELETE FROM album_photos WHERE album_id IN (SELECT id FROM albums WHERE slug LIKE 'h10-%');
DELETE FROM albums WHERE slug LIKE 'h10-%';

INSERT INTO categories (slug, name, description, sort_order) VALUES
  ('h10-pager-category', 'H10 pager category', 'Fixture category that holds the pagination posts.', 90),
  ('h10-empty-category', 'H10 empty category', 'Fixture category with no posts.', 91);

INSERT INTO tags (slug, name, description) VALUES
  ('h10-pager-tag', 'h10-pager-tag', 'Fixture tag that holds the pagination posts.'),
  ('h10-empty-tag', 'h10-empty-tag', 'Fixture tag with no posts.');

INSERT INTO albums (slug, title, description, date, published, tags)
SELECT 'h10-fixture-album-' || lpad(n::text, 2, '0'),
       'H10 fixture album ' || n,
       'Fixture album without photos.',
       DATE '2024-03-01' + n,
       true,
       ARRAY['h10-fixture']
FROM generate_series(1, 13) AS n;

INSERT INTO posts (slug, title, description, body_md, published_at, published, draft, category_id, category_slug, reading_minutes)
SELECT 'h10-fixture-post-' || lpad(n::text, 3, '0'),
       'H10 fixture post ' || n,
       'Temporary fixture row for the archive and taxonomy pagination check.',
       'fixture',
       TIMESTAMPTZ '2023-04-20 09:00:00+08' - (n || ' days')::interval,
       true,
       false,
       (SELECT id FROM categories WHERE slug = 'h10-pager-category'),
       'h10-pager-category',
       2
FROM generate_series(1, 101) AS n;

INSERT INTO posts (slug, title, description, body_md, published_at, published, draft, category_slug) VALUES
  ('h10-draft-post', 'H10 draft post', 'Fixture draft row that must never be listed.', 'fixture', TIMESTAMPTZ '2023-06-01 09:00:00+08', false, true, NULL),
  ('h10-unpublished-post', 'H10 unpublished post', 'Fixture unpublished row that must never be listed.', 'fixture', TIMESTAMPTZ '2023-06-02 09:00:00+08', false, false, NULL),
  ('h10-undated-post', 'H10 undated post', 'Fixture visible row without a publish date.', 'fixture', NULL, true, false, NULL);

INSERT INTO post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM posts p, tags t
WHERE p.slug LIKE 'h10-fixture-post-%' AND t.slug = 'h10-pager-tag';

COMMIT;
