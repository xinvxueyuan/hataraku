BEGIN;

DELETE FROM micro_posts WHERE slug LIKE 'h25-%';
DELETE FROM changelog_entries WHERE slug LIKE 'h25-%';

COMMIT;
