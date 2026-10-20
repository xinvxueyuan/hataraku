-- H17 fixtures: micro feed, changelog, tools and extra projects.
--
-- Every row carries the `h17-` slug prefix so cleanup can remove exactly what this file wrote.
--   docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1 < artifacts/h17/fixtures.sql

BEGIN;

DELETE FROM micro_posts WHERE slug LIKE 'h17-%';
DELETE FROM changelog_entries WHERE slug LIKE 'h17-%';
DELETE FROM tools WHERE slug LIKE 'h17-%';
DELETE FROM projects WHERE slug LIKE 'h17-%';

INSERT INTO micro_posts (slug, type, content, published, published_at, tags, image_keys)
SELECT 'h17-micro-' || lpad(n::text, 2, '0'),
       (ARRAY['note', 'code', 'dialogue', 'music'])[1 + (n % 4)],
       'H17 fixture fragment ' || n || E'.\nSecond line keeps its break.',
       true,
       TIMESTAMPTZ '2026-09-30 09:00:00+08' - (n || ' hours')::interval,
       CASE WHEN n % 3 = 0 THEN ARRAY['h17', 'fixture'] ELSE ARRAY['h17'] END,
       CASE WHEN n = 1 THEN ARRAY['albums/acg-example/1.webp'] ELSE ARRAY[]::text[] END
FROM generate_series(1, 23) AS n;

UPDATE micro_posts
   SET music = '{"track": "Fixture Track", "artist": "H17", "url": "https://example.org/h17-track"}'::jsonb
 WHERE slug = 'h17-micro-04';

INSERT INTO changelog_entries (slug, version, released_at, highlight, title, changes)
SELECT 'h17-changelog-' || lpad(n::text, 2, '0'),
       'v9.9.' || n,
       DATE '2026-09-30' - n,
       n = 1,
       'H17 fixture release ' || n,
       ARRAY['Fixture change ' || n, 'Second fixture change ' || n]
FROM generate_series(1, 21) AS n;

UPDATE changelog_entries
   SET changes = ARRAY[]::text[],
       body_md = 'Fixture body used when an entry has no structured changes.'
 WHERE slug = 'h17-changelog-21';

INSERT INTO tools (slug, name, category, description, published, featured, sort_order, tags)
SELECT 'h17-tool-' || lpad(n::text, 2, '0'),
       'H17 fixture tool ' || n,
       (ARRAY['editor', 'terminal', 'devtools'])[1 + (n % 3)],
       'Temporary fixture tool used to verify the toolbox page.',
       true,
       n % 4 = 0,
       n,
       ARRAY['h17']
FROM generate_series(1, 13) AS n;

INSERT INTO projects (slug, title, description, status, featured, published, sort_order, published_at, tags, cover_key)
SELECT 'h17-project-' || lpad(n::text, 2, '0'),
       'H17 fixture project ' || n,
       'Temporary fixture project used to verify the project cards.',
       (ARRAY['active', 'wip', 'archived'])[1 + (n % 3)],
       n % 3 = 0,
       true,
       100 + n,
       TIMESTAMPTZ '2026-09-01 09:00:00+08' - (n || ' days')::interval,
       ARRAY['h17'],
       CASE WHEN n = 1 THEN 'projects/xinvstar/cover.webp' ELSE NULL END
FROM generate_series(1, 11) AS n;

COMMIT;