-- Removes everything artifacts/h10/fixtures.sql wrote. Safe to run more than once.

BEGIN;

DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE slug LIKE 'h10-%');
DELETE FROM posts WHERE slug LIKE 'h10-%';
DELETE FROM tags WHERE slug LIKE 'h10-%';
DELETE FROM categories WHERE slug LIKE 'h10-%';
DELETE FROM album_photos WHERE album_id IN (SELECT id FROM albums WHERE slug LIKE 'h10-%');
DELETE FROM albums WHERE slug LIKE 'h10-%';

COMMIT;
