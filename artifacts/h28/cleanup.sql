BEGIN;

DELETE FROM timeline_entries WHERE slug LIKE 'h28-%';
DELETE FROM friends WHERE slug LIKE 'h28-%';

COMMIT;
