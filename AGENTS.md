<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project

`vibestart.jsonc` records the stack this project was created with. When it also records the `name` and `version` of the vibestart release that generated the project, the vibestart CLI maintains the project from it: `npx vibestart-cli add` adds a capability, and `npx vibestart-cli upgrade --dry-run` previews a template upgrade. Leave `vibestart.jsonc` as the CLI wrote it. An upgrade merges infrastructure files such as `package.json`, `vite.config.ts`, and this file, and lists template changes to starter source, which is yours to edit, as manual changes to port.

## Code

Converge on the simplest durable design that meets current requirements, and land it directly. The change you land is the design that stays.

- Make routine judgment calls yourself. Ask when readings of the request lead to materially different work; when no one can answer, take the reading the code supports and state it in your report.
- Fix the root cause at the abstraction that owns it. Carry the change through every layer it touches, and leave unrelated areas intact.
- Open with a tracer bullet: the smallest end-to-end slice that works, grown in complete layers. Add a concept, configuration option, or extension point only for a use case that exists now.
- One representation, one execution path. Move every in-repository consumer to the final interface, and delete the obsolete API, schema, implementation, configuration, tests, and documentation in the same change. The final interface stands alone: no adapter, deprecated alias, dual read or write, fallback, feature flag, or migration layer beside it.
- A compatibility path exists only for a verified external constraint: a deployed consumer, a public contract, persisted production data, or a staged rollout. An assumed consumer is not a constraint. Isolate the path, name the condition that removes it, and let the final state shape the core. When production state cannot change atomically, ship an explicit, reversible migration with a defined end.
- Validate untrusted data where it enters, then trust it. Type it as `unknown`, narrow it with a schema or a type guard, and make invalid states unrepresentable so later code does not re-check them. `any` is not a type in this repo. Back every type assertion and non-null assertion with a runtime check or a stated invariant. Catch an error only where you recover from it or add context; let the rest propagate.
- Names carry the meaning. A comment states a why the code cannot: an external constraint, counterintuitive behavior, an invariant, or a tradeoff. It speaks to the next reader, never about the change, its history, or its reviewer. Delete a comment that restates the code or has gone stale.
- Lint serves the design. When a rule's concern applies, fix the code. When a rule misfires on the idiom a library documents, keep the idiom and turn the rule off for that library's files in a `lint.overrides` entry in `vite.config.ts`, with a comment naming the idiom.
- Reuse before you write: search the repo's own modules, then its dependencies, their docs, and their types. Otherwise add one mature, maintained library when it lowers total complexity or raises reliability, at the latest stable version the toolchain accepts, and follow its current docs. One library per capability; a few lines of domain logic stay inline.

## Map

| Path                  | Owns                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js App Router app: pages and layouts in `src/app/`, route handlers, client components in `src/components/`; e2e tests in `tests/e2e/`  |
| `apps/web/src/server` | Server-only code (`import "server-only"`): `readEnv()` with `SERVER_URL`, the proxy to the API server, server query utilities, `getSession` |
| `apps/server`         | Hono on Node: `env`, the shared `db` and `auth` instances, Better Auth at `/api/auth`, oRPC at `/rpc`, OpenAPI and docs at `/api`           |
| `packages/api`        | oRPC routers, `publicProcedure`, `protectedProcedure`, and the `AppRouter` type the web client is typed from                                |
| `packages/db`         | Drizzle schema (`src/schema/`, including Better Auth tables), relations, migrations (`src/migrations/`), `createDb`                         |
| `packages/auth`       | Better Auth configuration (`createAuth`) and the `Session` type                                                                             |
| `packages/ui`         | shadcn/ui components (Base UI), Tailwind theme in `src/styles/globals.css`                                                                  |
| `apps/mobile`         | Expo Router screens, mobile UI components, and the Uniwind theme                                                                            |
| `packages/config`     | Shared TypeScript presets                                                                                                                   |

`vp run dev` serves the app on :3000 and the API server (`apps/server`) on :3001. The browser talks only to the app: its `/rpc/*` and `/api/*` route handlers (including `/api/auth`) forward to the API server at `SERVER_URL`, so session cookies are first-party and there is no CORS configuration.

A Server Component page prefetches with `serverApi` and `getQueryClient()` from `src/server/query.ts`, which call `SERVER_URL` directly with the request's cookies, then wraps its client component in `<HydrationBoundary state={dehydrate(queryClient)}>`. The client component reads the same query with `api` from `src/lib/api.ts` (`useSuspenseQuery`) and mutates through `/rpc`. Both utilities derive identical query keys, so hydrated data is not refetched.

This is Next.js 16. Before calling a Next API, read the matching guide in `apps/web/node_modules/next/dist/docs/`. `params` and `searchParams` are promises, and `middleware` is now `proxy`.

The mobile app in `apps/mobile` runs on Expo with Expo Router: each file in `src/app` is a screen, and `_layout.tsx` holds the navigation stack. `vp run dev:mobile` starts Metro and prints a QR code for Expo Go. It runs beside `vp run dev`, in a terminal of its own, because Expo's terminal UI cannot share one. The app calls the server at the origin `src/env.ts` resolves: `EXPO_PUBLIC_API_URL` when it is set, otherwise, in development, port 3000 on the machine Metro runs on (`src/lib/api-url.ts`). A release build has no Metro, so it needs `EXPO_PUBLIC_API_URL`. Better Auth's Expo client (`src/lib/auth-client.ts`) keeps the session in SecureStore. Native fetch has no cookie jar, so `src/lib/api.ts` sends the session cookie itself. The server trusts `hataraku://`, the app's scheme, as its origin. Uniwind compiles Tailwind classes for React Native; the theme is the CSS variables in `apps/mobile/global.css`. Unit tests run in Node, where `react-native` does not load, so they cover logic kept out of components, as `src/lib/api-url.test.ts` does. `vp run build` exports the iOS and Android bundles with `expo export`. A native module Expo Go does not ship needs a development build: `vp run --filter @hataraku/mobile ios` or `android`.

## Conventions

- **Server.** A file is a Server Component until it starts with `"use client"`. Hooks, event handlers, `api`, and `authClient` belong in client components. A server-only module imports `"server-only"`, so a client import fails the build.
- **Environment.** Declare every server variable in `apps/server/src/env.ts` and list it, with a safe example value, under Environment in `README.md`. Keep real values in the ignored `.env` file. Code reads `env`. The web app is shipped to the browser, so it holds no secret.
- **Procedure.** Add it on a router in `packages/api/src/routers/` and register that router in `packages/api/src/index.ts`. Validate input with Zod, read the database from `context.db`, and throw `ORPCError` for an expected failure. The web client takes the new type with no codegen step.
- **Schema.** Add or edit a table in `packages/db/src/schema/`, register a new table in `src/relations.ts`, and back each invariant with a constraint (`check`, `unique`, foreign keys) as well as Zod. Run `vp run db:generate` and commit the new folder under `src/migrations/`. A committed migration stays as generated. The Better Auth tables in `schema/auth.ts` match the fields Better Auth expects; read its docs before adding a plugin.
- **Authorization.** A procedure that reads or writes user data is a `protectedProcedure` and scopes every query by `context.session.user.id`. Someone else's row is `NOT_FOUND`, which does not reveal that the id exists. Each new protected procedure gets an integration test as an anonymous caller and as another user.
- **Protected page.** A page that needs a user calls `getSession()` and `redirect("/login?redirect=…")` when the session is missing. Add the page to `redirectTargets` in `src/app/login/page.tsx`; any other redirect value falls back to `/todos`. The page hide is UX, and the procedure is the security boundary.
- **Proxy.** Better Auth rate-limits by client IP. Behind a reverse proxy, set `advanced.ipAddress` in `packages/auth` to the header that proxy sets. With no proxy, leave forwarding headers untrusted.
- **UI.** From `packages/ui`, run `pnpm dlx shadcn@latest add <component>` and import `@hataraku/ui/components/<name>`. Files in `packages/ui/src/components` are vendored shadcn and are not linted. App code is checked by `@shadcn/lint`: style a component through its variants, and use `className` on it only for layout. When the first file lands in `src/hooks`, add `"./hooks/*": "./src/hooks/*.ts"` to the package exports (`components.json` already aliases that path).
- **Mobile.** Add a screen as a file in `apps/mobile/src/app`. Style React Native components with Tailwind classes in `className`, and reuse the components in `apps/mobile/src/components/ui`.
- **Protected screen.** A screen that needs a user is listed under a `Stack.Protected guard={signedIn}` in `apps/mobile/src/app/_layout.tsx`. The guard is UX, and the server is the security boundary.
- **Generated.** `.next/`, `next-env.d.ts`, `packages/db/src/migrations/**`, and `apps/mobile/uniwind-types.d.ts` are tool output. Leave them unchanged. `vp run dev` refreshes `typedRoutes` and `PageProps`. A fresh clone runs `vp run typegen` before `vp check`. Metro rewrites it from the themes in `global.css`.
- **Utilities.** Import shared helpers from [es-toolkit](https://es-toolkit.dev/llms.txt), from the submodule the docs name (`import { retry } from "es-toolkit/function"`). `es-toolkit/compat` stays out.
- **Knip.** Delete what `vp run knip` reports: unused files, exports, dependencies, and catalog entries. Add a Knip config entry only when a plugin cannot see a real reference.
- **Ultracite.** Run `vp check` to apply the Ultracite lint and formatting presets, including framework rules and anti-slop checks for AI-written code. Fix the reported code instead of disabling the rules.

## Tests

A test earns its upkeep when its expected values come from a source independent of the code: the request, an acceptance criterion, a documented contract, or a domain rule, written down before the implementation. A test derived from reading the implementation restates it and catches nothing.

- Cover a change with the broadest test that reaches it. End-to-end journeys and integration tests through the real stack carry most of the confidence; a unit test is for dense logic with many cases: calculations, parsers, state machines, permissions.
- Test behavior at the boundary that owns it: the exported API, the command, the route or procedure, the page. A test that breaks under a behavior-preserving refactor is pinned to the implementation; move it to that boundary.
- Before adding a test, name the regression that makes it fail, and confirm no type, schema, lint rule, or existing test already catches it. Each contract has one owning test; extend its table of cases rather than adding a near-copy.
- Run this repo's own code for real. A fake stands in only for a service this repo does not run, with the reason next to it and a contract test that pins the request and response it imitates.
- Watch every new test go red before it goes green. A bug fix starts from a test that reproduces the bug.
- When a test fails, fix the code. Change, skip, or weaken an assertion only when the specified behavior changed, and say so in your report.

| Layer       | Location                                                                                | Runs against                                                                                                  | Write it for                                                                             |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| End-to-end  | `apps/web/tests/e2e/*.e2e.ts`                                                           | TesterArmy e2e driving Chromium against the real web app, API, and PostgreSQL                                 | Journeys that decide whether the product works                                           |
| Integration | `packages/api/tests/integration/*.test.ts`                                              | Vitest calling `appRouter` in process through `createRouterClient`, real sessions, a real PostgreSQL database | Every procedure's validation, error codes, authorization, and invariants                 |
| Unit        | `*.test.ts` beside the code in `apps/server/src`, `apps/mobile/src` or `packages/*/src` | Node, no I/O                                                                                                  | Branching logic: pricing, permissions, state machines, parsers, calculations, edge cases |

`apps/web/e2e.config.ts` runs `tests/support/start.ts` to start the stack for the e2e tests on :3200 (`E2E_TEST_PORT`): a fresh PostgreSQL database, the real Hono server, and `next dev` in its own `.next-test-<port>`, beside any running dev server in front, with the same proxy and origin as development. A second checkout runs its tests at the same time on another port. Each integration test file gets a database of its own from `createTestDatabase()` in `@hataraku/db/testing`, migrated and removed when the file ends, so files run in parallel. Test databases are created beside `DATABASE_URL` from `apps/server/.env`, so the tests need PostgreSQL running. Tests sign up a new user with `signUp()`, so they share no rows.

Use `visit()` and `reload()` (`waitUntil: "networkidle"`) before interacting so server-rendered pages finish hydrating. Query with `screen`, act with `tap()` and `fill()`, and assert with `expect` from `e2e`. Generated tests need no model; configure an agent in `e2e.config.ts` for natural-language steps.

The app command inherits only `PATH`, `HOME`, temporary-directory variables, and `e2e.config.ts` overrides. Forward any additional required variables there. Logs: `apps/web/.e2e/server.log`; report: `.e2e/report.json`; failure traces: `.e2e/artifacts`. Rerun failures from `apps/web` with `vp exec e2e run --last-failed`.

Integration tests call the procedures in this process, through the same middleware and validation as a request, with real Better Auth sessions and a real database.

E2E tests in `apps/web/tests/e2e` are the specification: changing, skipping, or weakening an assertion takes the user's approval first.

While iterating, run the narrowest set that covers the change: `vp test --project unit`, `vp test --project integration`, `vp test --changed`, a single file, or `vp exec e2e run <file>` in `apps/web`.

## Done

The change is done when every modified path works end to end, every rule in this file holds in every modified file, and `vp run ready` passes.

Before you report it, review the whole diff in a fresh context when your tools allow one: read the failure and cleanup paths, a second run against existing state, and every caller of what changed, and fix what you find.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **hataraku** (2201 symbols, 4938 relationships, 122 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only`. No `.gitnexus/run.cjs`? Bootstrap with `npx`, `bunx`, or `pnpm dlx`; e.g. `bunx gitnexus@latest analyze` (#1939).
> On query/context/impact/cypher object results, read staleness.status and branch/lastCommit. Re-analyze only for behind or diverged — current is clone HEAD, not main.

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers/processes/risk. Never substitute grep for graph analysis.
- **MUST analyze changes before commit.** Run `detect_changes({scope: "all"})` or `node .gitnexus/run.cjs detect-changes --scope all --repo .`. `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review, fetch target branch "main" from its remote; compute its merge base with the reviewed HEAD and pass that SHA to `detect_changes({scope: "compare", base_ref: "<merge-base SHA>"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "<merge-base SHA>" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` with `dry_run: true`, review semantic spans and coverage, then apply with `dry_run: false` and its `plan_token`.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource                                  | Use for                                  |
| ----------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/hataraku/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/hataraku/clusters`       | All functional areas                     |
| `gitnexus://repo/hataraku/processes`      | All execution flows                      |
| `gitnexus://repo/hataraku/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
