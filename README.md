# hataraku

Next.js · Hono · oRPC · PostgreSQL · Drizzle · Better Auth · Expo · Node, on [Vite+](https://viteplus.dev).

| Layer     | Choice                                                                   |
| --------- | ------------------------------------------------------------------------ |
| Framework | Next.js 16 App Router, React 19 with React Compiler, typed routes        |
| Data      | TanStack Query, prefetched in Server Components and hydrated, Tailwind 4 |
| Backend   | Hono on Node.js 24                                                       |
| API       | oRPC (end-to-end types, no codegen) plus OpenAPI at `/api`               |
| Database  | PostgreSQL 18, Drizzle ORM v1                                            |
| Auth      | Better Auth, email and password, sessions in PostgreSQL                  |
| UI        | shadcn/ui on Base UI, in `packages/ui`                                   |
| Mobile    | Expo SDK 58 with Expo Router and Uniwind (Tailwind CSS 4)                |
| Toolchain | Vite+ (`vp`): lint, format, type check, test; Next.js builds the app     |

## Getting started

```sh
vp install
docker compose up -d db   # or point DATABASE_URL at any Postgres; host port 55432
vp run db:migrate
vp run dev
vp run dev:mobile         # in a second terminal
```

Open http://localhost:3000 and create an account. API docs are at http://localhost:3000/api.

`vp run dev:mobile` prints a QR code: scan it with Expo Go on a phone on the same network as this machine, or press `i` or `a` for a simulator. The app reaches the server on port 3000 of this machine, so let the firewall pass it; a release build takes the server's origin from `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`.

## Environment

Each app loads the `.env` in its directory. Project creation wrote them with the values below and generated a unique `BETTER_AUTH_SECRET`. Git ignores these files. For a fresh clone, recreate them from these examples and fill in the empty `BETTER_AUTH_SECRET` with the output of `openssl rand -base64 32`; the server rejects an unset secret.

`apps/web/.env`

```dotenv
SERVER_URL=http://localhost:3001
```

`apps/server/.env`

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:55432/hataraku
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=
NODE_ENV=development
PORT=3001
```

The container publishes Postgres on host port 55432, not 5432: Windows reserves 5432 inside a
Hyper-V range, so Docker cannot bind it. `docker-compose.override.yml` carries the override; the
base compose file keeps the conventional 5432 for other platforms.

`apps/mobile/.env`

```dotenv
# The API origin of a release build. Leave it empty in development: the app reaches the server
# on the machine Metro runs on, at port 3000.
EXPO_PUBLIC_API_URL=
```

## Commands

```sh
vp run typegen    # route types for typedRoutes; dev does this automatically
vp check          # format, lint, type check
vp run knip       # unused files, exports, dependencies, and catalog entries
vp test           # unit and integration tests (Vitest)
vp run test:e2e   # end-to-end tests (TesterArmy e2e) in Chromium, against a real server and database
vp run ready      # typegen + check + knip + test + test:e2e + production build
```

The first `vp run test:e2e` needs a browser: `cd apps/web && vp exec e2e-web install chromium`.

TesterArmy e2e sends anonymous usage telemetry; set `E2E_TELEMETRY_DISABLED=1` to turn it off.

## Database

Edit a table in `packages/db/src/schema/`, then:

```sh
vp run db:generate   # writes a migration to packages/db/src/migrations/
vp run db:migrate    # applies it
```
