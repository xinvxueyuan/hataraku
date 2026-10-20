# H16 — the web deployment serves its own API

## The loop that took the site down

The Vercel deployment was READY and every page answered 500 with
`INFINITE_LOOP_DETECTED (508)`. Four call sites on the web side reached the API over HTTP, and in a
single deployment `SERVER_URL` is the deployment's own origin:

| Call site                                   | What it did                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| `app/api/[[...rest]]/route.ts`              | `proxyToServer` forwarded `/api/*` to `SERVER_URL`    |
| `app/rpc/[[...rest]]/route.ts`              | `proxyToServer` forwarded `/rpc/*` to `SERVER_URL`    |
| `server/query.ts` (`serverCall`/`serverApi`) | `RPCLink` posted every server-component read to `SERVER_URL/rpc` |
| `server/session.ts` (`getSession`)          | Better Auth's HTTP client called `SERVER_URL`         |

The function called itself, so the edge refused to route it.

## What the web deployment does now

`apps/web/src/server/api.ts` (server-only) is the one owner of the database, the Better Auth
instance and both oRPC transports:

- `getDb()` — one `createDb(DATABASE_URL)` per process, created on first use.
- `getAuth()` — one `createAuth(...)` per process, configured exactly as the standalone server
  configures it (allowlist, Turnstile-when-a-key-exists, `hataraku://` origin).
- `handleApiRequest(request, "/api" | "/rpc")` — builds the context `{ db, session, adminEmails }`
  per request and dispatches:
  - `/api/auth/*` → `auth.handler(request)` (Better Auth);
  - `/rpc/*` → `RPCHandler(appRouter)`;
  - `/api/*` → `OpenAPIHandler(appRouter)`.

The two catch-all routes keep every method (GET/POST/PUT/PATCH/DELETE/HEAD) and call it.
`server/query.ts` now calls `createRouterClient(appRouter, { context })` with the context resolved
per call (`context` is a function, so one module-level client still sees each request's session),
and `server/session.ts` calls `auth.api.getSession({ headers })` directly. `server/proxy.ts` is
deleted; nothing on the web side reads `SERVER_URL` any more.

### Judgment call: /api mounts the OpenAPI transport too

`/api` is not only the RPC fallback. The old proxy forwarded everything, so the OpenAPI document and
reference UI were public at `/api`; and the e2e harness polls `/api/health` on the web origin as its
startup contract. Dropping the OpenAPI handler would have silently removed both. It is mounted with
the same reference plugin the standalone server uses.

### SERVER_URL

No web code reads it. It stays declared in `readEnv()` and in `turbo.json`/`ci.yml` because the
mobile app and the standalone API deployment still use a real HTTP origin for the API; the web
server renders in process and does not need one. Files that still mention it:
`apps/web/src/server/env.ts` (declaration only), `apps/web/tests/support/server.ts` (passed to the
web child, unused), `.github/workflows/ci.yml`, `turbo.json`.

## Environment the web deployment now needs

| Variable                               | Why                                                      |
| -------------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`                         | the web process opens the database itself                 |
| `BETTER_AUTH_SECRET` (32+ chars)       | signs session cookies; must match the sessions in the DB  |
| `BETTER_AUTH_URL`                      | the public origin Better Auth issues cookies for          |
| `ADMIN_EMAILS` (optional)              | the write allowlist the procedures read                   |
| `TURNSTILE_SECRET_KEY` (optional)      | enables the captcha plugin exactly as on the server       |

`next build` does **not** need them: every route renders dynamically, so the build bails out at
`headers()` before the auth instance reads the environment. Verified by building with no database
or auth variables at all (all routes reported `ƒ` dynamic; only `/robots.txt` is static and needs
nothing).

## One file outside the declared write scope (needs approval)

`apps/web/tests/support/server.ts` — the e2e harness. The web child now receives
`DATABASE_URL: database.url`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL: baseURL`, because the web
process opens the database itself. Without this the browser tests would silently read the developer
database (locally) or an unmigrated empty database (CI), because the web child inherited whatever
`DATABASE_URL` the harness process had. **No e2e assertion, file or selector changed**; the
standalone API child is still started and health-checked, so the two-process startup contract is
intact.

## Evidence

`artifacts/h16/verify-single-deployment.mjs` drives a real Chromium twice against the harness
stack on 3400/3401:

- `PROBE_PHASE=before` (both processes up): **11/11** — pages render data, sign-up works,
  `get-session` reads the cookie, `/rpc/todos/create` writes, `/rpc/todos/list` reads it back,
  `/api` answers, `/todos` and `/settings/two-factor` render behind the session.
- then the API process on 3401 is stopped by port (not by process name) and
  `PROBE_PHASE=after` runs the identical checks: **11/11**, with `3401 -> unreachable`. A page that
  still renders its data can only have read it in process.

Results: `verification-before.json`, `verification-after.json`; screenshots in `screenshots/`
(`after-01-home.png` is the home page while the API process is dead).

Other gates on the final tree:

| Gate                | Result                                                              |
| ------------------- | ------------------------------------------------------------------- |
| `vp check --no-fmt` | 143 files, no lint or type errors                                    |
| `vp test`           | 12 files, 117 tests                                                  |
| e2e (frozen spec)   | 7/7 tests, untouched                                                |
| `turbo run build`   | green without DB/auth env                                           |
| `pnpm run ready`    | currently red only on peers' in-flight files (see the task report)  |

## Why the production deploy will answer 200

There is no code path left that fetches `SERVER_URL`: the two route handlers dispatch to the
handlers in process, server components call the router through `createRouterClient`, and
`getSession` reads the cookie through `auth.api.getSession`. The only outbound network calls the
web process makes are to PostgreSQL. With `DATABASE_URL`, `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL` on the Vercel project, the deployment is self-contained and the edge never sees a
request from the function to itself.
