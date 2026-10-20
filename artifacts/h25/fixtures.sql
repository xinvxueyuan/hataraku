-- H25 fixtures: three micro posts and three changelog entries, so the machine endpoints can be
-- checked against non-empty content types. Every row uses the h25- prefix.
--   Get-Content -Raw artifacts/h25/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1

BEGIN;

DELETE FROM micro_posts WHERE slug LIKE 'h25-%';
DELETE FROM changelog_entries WHERE slug LIKE 'h25-%';

INSERT INTO micro_posts (slug, type, content, published, published_at, tags) VALUES
  ('h25-micro-01', 'note', E'第一行\n第二行（换行应保留）', true, TIMESTAMPTZ '2026-10-01 09:00:00+08', ARRAY['h25', 'verify']),
  ('h25-micro-02', 'code', 'const answer = 42;', true, TIMESTAMPTZ '2026-09-30 09:00:00+08', ARRAY['h25']),
  ('h25-micro-03', 'dialogue', '“今天也要写点东西。”', true, TIMESTAMPTZ '2026-09-29 09:00:00+08', ARRAY['h25']);

INSERT INTO changelog_entries (slug, version, released_at, highlight, title, changes, body_md) VALUES
  ('h25-changelog-01', 'v9.9.3', DATE '2026-10-01', true, '验证版本', ARRAY['新增机器面页', '修复示例'], NULL),
  ('h25-changelog-02', 'v9.9.2', DATE '2026-09-30', false, NULL, ARRAY[]::text[], '只有正文的条目正文内容。'),
  ('h25-changelog-03', 'v9.9.1', DATE '2026-09-29', false, '旧版本', ARRAY['旧变更'], NULL);

COMMIT;
