# H13 content migration: the old Neon database into hataraku

Moves the published content from the old site's database (`neondb` on Neon project
`plain-sea-29389556`, branch `br-jolly-mud-a1irpdke`) into the hataraku database on the same
branch. `scripts/migrate-content.ts` is the whole mechanism; this directory holds the evidence.

## What is copied, and in what order

`categories, posts, tags, post_tags, projects, micro_posts, changelog_entries, tools, friends,
skills, albums, album_photos, devices, diary_entries, timeline_entries, site_profile`

The order satisfies the one foreign key among these tables (`album_photos.album_id -> albums.id`).
`posts.category_id` and `post_tags` carry logical references only, and the order keeps those
satisfiable as well. `login_attempts` is deliberately absent: its rows are short-lived audit data
and the new deployment keeps its own. `search_index` is absent because triggers own it (below).

## Strategy: upsert on the primary key

Chosen over truncate-and-copy because it is idempotent *and* non-destructive. A second run rewrites
the same rows instead of duplicating them, and it never deletes a row that exists only in the
target. Truncate-and-copy would wipe rows the new deployment created between runs, and it would
need the foreign key disabled.

The trade-off is that a row deleted at the source survives in the target, so the reconciliation
prints a row-count or content-digest difference instead of hiding it. For a content move, a
reported mismatch is more useful than a silent wipe.

Re-running against a populated target was measured, not assumed: `target_before` equals
`target_after` on every table in `cold-rehearsal-rerun.txt`.

## How values travel

Every column is read through the *target* catalog, so the copy writes exactly the columns this
schema has, and a source column that no longer exists fails loudly instead of being skipped.

`timestamptz`, `timestamp` and `date` travel as PostgreSQL's own text form and are cast back
server-side (`$n::text::timestamptz`). A `timestamptz` holds microseconds and a JavaScript `Date`
holds milliseconds, so a native round trip truncates sub-millisecond digits; `date` is parsed as a
JavaScript `Date` at local midnight. Every other column stays native, because the driver mangles
some of them the other way round: a JavaScript string bound to `::boolean` lands as false whatever
it says.

Each client is opened with `max: 1`. The run sets `time zone 'UTC'` and `datestyle = 'ISO, YMD'`
per session so both servers render timestamps identically, and a pool could hand a digest query a
connection that never received those settings.

## search_index is not copied

It is a projection of `posts` maintained by triggers, so copying the source rows would import a
snapshot that could already be stale. The copy lets the triggers build it, then calls
`refresh_search_index(id)` for every post as a repair and deletes vectors whose post no longer
exists. Verification is two-sided:

- every rebuilt tsvector is compared with the source vector, and the row's text (title,
  description, body, tags, published_at) with the source row;
- the same two-pass query the search procedure runs (`ns_tsquery_text` AND, then
  `ns_tsquery_text_or` when that finds nothing) is run against both databases for the first two
  CJK characters of eight published titles, plus the `不存在的词xyz` precision guard.

## Running it

Connection strings come from the environment and are never printed or committed: the run names the
host and database only.

```sh
SOURCE_DATABASE_URL=<old neondb url> TARGET_DATABASE_URL=<target url> \
  node scripts/migrate-content.ts [--dry-run] [--report artifacts/h13/reports/<name>.json]
```

`--dry-run` reads the source counts and writes nothing. `--report` writes the machine-readable
reconciliation next to the console output and is what the evidence below was generated from.

The cold rehearsal used `artifacts/h13/rehearse-cold.ts create|drop` (with `REHEARSAL_ADMIN_URL`
set) to build and remove an empty, migrated database beside the local container's `hataraku` one,
so both the insert path and the upsert path were exercised.

## Evidence

| Run                    | Target                                        | Log                                     | Report                                          | Exit |
| ---------------------- | --------------------------------------------- | --------------------------------------- | ----------------------------------------------- | ---- |
| Cold rehearsal         | fresh `hataraku_h13_rehearsal` (created, migrated, dropped) | `cold-rehearsal.txt` | `reports/cold-rehearsal.json` | 0 |
| Cold rehearsal, rerun  | the same database after the copy               | `cold-rehearsal-rerun.txt` | `reports/cold-rehearsal-rerun.json` | 0 |
| Local container        | `127.0.0.1:5432/hataraku`                     | `local-container.txt`                  | `reports/local-container.json`                  | 0    |
| Neon production branch | `ep-noisy-sunset-…neon.tech/hataraku`        | `neon-hataraku.txt`                    | `reports/neon-hataraku.json`                    | 0    |

Row counts read from the source during the run (`dry-run` output and the copy section agree):

| Table              | Rows | Table              | Rows |
| ------------------ | ---- | ------------------ | ---- |
| categories         | 7    | albums             | 1    |
| posts              | 39   | album_photos       | 22   |
| tags               | 96   | devices            | 2    |
| post_tags          | 122  | skills             | 5    |
| projects           | 2    | site_profile       | 1    |
| micro_posts        | 0    | diary_entries      | 0    |
| changelog_entries  | 0    | timeline_entries   | 0    |
| tools              | 0    | friends            | 0    |

Every run reports, on both local targets and on Neon:

- 16/16 tables with identical row counts *and* identical content digests (a digest over the copied
  columns of every row, so a column drifting while the count holds would still fail);
- `vectors: source=39 target=39 tsv_mismatched=0 metadata_mismatched=0 missing=0`;
- 8/8 CJK probes find their own post, and their hit sets match the source;
- the precision guard returns 0 hits;
- `login_attempts` and `todos` counts unchanged (0 -> 0), which is the evidence that the copy
  leaves them alone.

The new files keep the static gate clean on their own (`gate-scope.txt`: `vp check scripts` exit 0,
`vp run knip` exit 0). The repository-wide `vp run ready` belongs to whoever runs the final gate on
a quiet tree; while this task ran, another task was still writing `apps/web/**`, and every
diagnostic that run reported was in those files.

## One configuration change outside the new files

`knip.json` names `scripts/**/*.ts` as an entry of the root workspace: an operator-run migration
is a real root the dependency graph cannot reach from a product import. `postgres` is listed in
`ignoreDependencies` because the script resolves it through `packages/db`, the workspace that
declares it, so knip cannot attribute the require to the root manifest. Both entries were needed to
keep `vp run knip` clean; no dependency was added to the repository.

## Files

| Path                          | Owns                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `scripts/migrate-content.ts`  | the copy, reconciliation, referential checks, search proof    |
| `scripts/tsconfig.json`       | type context for `vp check` (the root tsconfig omits `scripts`) |
| `artifacts/h13/rehearse-cold.ts` | create/drop of the empty rehearsal database                 |
| `artifacts/h13/probe-bind.ts` | transport probe: array, timestamptz microseconds, date, jsonb |
| `artifacts/h13/probe-db.ts`   | read-only inventory of a database (tables and row counts)     |
| `artifacts/h13/probe-databases.ts` | read-only list of databases on a server (proves the rehearsal database was dropped) |
| `artifacts/h13/gate-scope.txt` | `vp check scripts` and `vp run knip` exit 0 with the new files |
