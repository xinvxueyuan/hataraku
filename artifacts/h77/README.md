# H77 API tokens core

## Token table

`api_tokens` (migration `0001_api_tokens`, after `0000_init`):

| column | type | rule |
| --- | --- | --- |
| id | uuid | pk, `gen_random_uuid()` |
| name | text | not null; zod trims + non-empty |
| prefix | text | not null; `hkr_` + 8 base64url chars |
| token_hash | text | not null, unique (sha256 hex) |
| scopes | text[] | not null, default `{}` |
| created_at | timestamptz | not null, now() |
| last_used_at | timestamptz | nullable; conditional update > 1 minute |
| expires_at | timestamptz | nullable |
| revoked_at | timestamptz | nullable |

No plaintext is stored. `list`/`revoke` select `toRecord` fields only; `create` is the only response carrying `token`.

## Scope matrix

Known scopes: `posts:write`, `notes:write`, `projects:write`, `changelog:write` (four; the docs-publishing scope was cancelled with H79).

| procedures | scope | session |
| --- | --- | --- |
| `posts.create/update/publish/unpublish` | posts:write | admin session also allowed |
| `content.micro.create/update` | notes:write | admin session also allowed |
| `content.projects.create/update` | projects:write | admin session also allowed |
| `content.changelog.create/update` | changelog:write | admin session also allowed |
| every `remove` and `micro.publish` | — | adminProcedure only |

`writeProcedure(scope)` returns UNAUTHORIZED without a session/token, FORBIDDEN for a valid token missing the scope (or a non-admin session), and passes a valid scoped token or admin session.

## OpenAPI write surface

9 operations; paths use the procedure's real input (`id`, not `segment`):

| method | path | procedure | scope |
| --- | --- | --- | --- |
| POST | /posts | posts.create | posts:write |
| PATCH | /posts/{id} | posts.update | posts:write |
| POST | /posts/{id}/publish | posts.publish | posts:write |
| POST | /posts/{id}/unpublish | posts.unpublish | posts:write |
| POST | /notes | content.micro.create | notes:write |
| PATCH | /notes/{id} | content.micro.update | notes:write |
| POST | /projects | content.projects.create | projects:write |
| PATCH | /projects/{id} | content.projects.update | projects:write |
| POST | /changelog | content.changelog.create | changelog:write |

OpenAPI document check: 31 operations (22 read + 9 write); `components.securitySchemes.bearerToken` = http/bearer; every write operation has `security: [{ bearerToken: [] }]`; path params are generated (`id`). CORS is unchanged: `publicApiCorsHeaders` only recognizes reads, so writes get no wildcard CORS. `info.version` = 1.0.0 and `info.description` mentions public reads + token writes.

The HTTP write edge uses a dedicated `z.coerce.number().int()` post id schema: browser clients send path strings while RPC callers send numbers. `updatePostInput` had refinements, so the write-specific schema rebuilds the shape and reapplies the `slugOnly $rArr; slug` refinement. No procedure signature was changed for aesthetics.

## Resolution

`resolveApiToken(db, authorization)` in `packages/api/src/tokens.ts`:

1. `parseBearer` accepts exactly `Bearer hkr_` + 43 base64url chars; Basic/empty/malformed return null.
2. lookup by sha256 hash, `revoked_at is null`, and not expired.
3. conditional `last_used_at` update only when null or older than 1 minute.
4. returns `{ id, scopes }` or null; web injects `apiToken` only when there is no session.

## Local HTTP proof

See `http-evidence.txt`: create 200, publish 200, patch 200, notes 403; exact id and token row cleaned up (posts 39, tokens 0).

## Tests / gates

- integration `api-tokens.test.ts`: 8 passed (create/list no secret, resolver, correct scope, 403, revoked 401, expired 401, remove 401, session admin).
- unit tokens + openapi contract: 41 passed (11 token, 30 contract).
- `pnpm run ready`: EXIT=0 (308 tests, e2e 7/7, builds; repo-local untracked `explore/` moved aside).
- `check:compat` / `check:design` / `knip`: 0.
- `pnpm run db:migrate` twice: 0000_init + 0001_api_tokens, idempotent.
- `token_hash` references only schema/migration/token tool/tests; list never returns it.
