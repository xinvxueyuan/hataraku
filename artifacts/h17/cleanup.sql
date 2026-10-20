-- Removes everything artifacts/h17/fixtures.sql wrote. Safe to run more than once.

BEGIN;

DELETE FROM micro_posts WHERE slug LIKE 'h17-%';
DELETE FROM changelog_entries WHERE slug LIKE 'h17-%';
DELETE FROM tools WHERE slug LIKE 'h17-%';
DELETE FROM projects WHERE slug LIKE 'h17-%';

COMMIT;
