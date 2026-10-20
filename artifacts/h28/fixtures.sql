-- H28 fixtures: three timeline milestones and two friends, both with the h28- prefix.
--   Get-Content -Raw artifacts/h28/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1

BEGIN;

DELETE FROM timeline_entries WHERE slug LIKE 'h28-%';
DELETE FROM friends WHERE slug LIKE 'h28-%';

INSERT INTO timeline_entries (slug, title, description, date, category, highlight, link, published, sort_order) VALUES
  ('h28-timeline-01', '站点迁移到新栈', '从 v2 迁到 Next + Hono + oRPC，内容与页面逐项对账。', DATE '2026-10-21', 'milestone', true, 'https://example.org/migration', true, 1),
  ('h28-timeline-02', '机器可读面补齐', 'sitemap、llms、feed 覆盖新页面与新内容类型。', DATE '2026-10-20', 'release', false, NULL, true, 2),
  ('h28-timeline-03', '第一次线下分享', '聊了聊个人站点的内容管线。', DATE '2026-10-18', 'event', false, NULL, true, 3);

INSERT INTO friends (slug, name, url, description, tags, published, sort_order) VALUES
  ('h28-friend-01', '示例友链甲', 'https://example.org/friend-a', '一个同样在写技术博客的站点。', ARRAY['博客'], true, 1),
  ('h28-friend-02', '示例友链乙', 'https://example.org/friend-b', '影像与随笔。', ARRAY['摄影', '随笔'], true, 2);

COMMIT;
