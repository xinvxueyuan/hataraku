# H64 — compatibility becomes a machine check

The user's rule: a compatibility path is an isolated module with a stated end, never a flag, branch
or deprecated alias scattered through live code. This turns the rule into `scripts/check-compat.mjs`,
run by `pnpm run check:compat` in CI right after the design-system guardrails.

## What the check enforces

1. **Location.** Compatibility markers (`compat`, `legacy`, `backward`, `deprecated`, `LEGACY_`)
   may appear only inside `apps/web/src/compat/` or `packages/compat/`. The scan covers
   `apps/web/src` and every `packages/*/src`; a hit is reported as `file:line:column + reason`.
   Markers match as name segments (`legacyPostsHref`, `LEGACY_IMPORT`), not prose ("compatibility"
   in a sentence is ignored), and quoted strings are masked first so an `#compat/x` import
   specifier is not read as a marker.
2. **Module self-proof.** If either compat directory exists it must ship `REMOVAL.md` (or a header
   comment on its entry file) that names **the constraint** and **the removal condition**.
3. **Import annotations.** Every import of `#compat/*`, `#src/compat/*`, `@hataraku/compat` or
   `./compat/*` must carry `// compat: <constraint>` on its line or the line above.

**Explicit allow list, printed on every run:** `docs/`, `artifacts/`, `AGENTS.md`, `CHANGELOG`,
`packages/db/src/migrations/` (generated SQL) and the two compat module directories themselves —
each with the reason it is allowed.

**One temporary source exception** is declared in the script and printed every run:
`packages/api/src/routers/admin-posts.ts` line with the "A legacy `cover` object" comment. H62 deletes
the legacy `posts.cover` column, so the clearing write and its comment leave with it. The allowlist is
self-cleaning: an entry that no longer matches anything **fails** the check, so it cannot outlive its
code.

## The three deliberate breaks

Each run captured in this directory.

**a. A compatibility marker in an ordinary component** (`apps/web/src/components/h64-marker-fixture.ts`):

```
apps/web/src/components/h64-marker-fixture.ts:1:14 compat: marker "legacy" outside the compatibility module - move it into apps/web/src/compat or packages/compat, or delete the path
compatibility check failed: 1 violation(s) in 172 source file(s)
```

Deleted the file → `compatibility check passed` (`a-pass.txt`).

**b. A compat directory without a removal condition** (`apps/web/src/compat/README.md` only):

```
apps/web/src/compat:1:1 compat: apps/web/src/compat exists without REMOVAL.md (and without an entry file header) — state the constraint and the removal condition
compatibility check failed: 1 violation(s) in 171 source file(s)
```

Added `REMOVAL.md` with the constraint and the removal condition → passed (`b-pass.txt`), and the run
printed `allow apps/web/src/compat/ - compatibility module; constraint and removal condition declared`.

**c. A compat import without the annotation** (`apps/web/src/components/h64-import-fixture.ts`):

```
apps/web/src/components/h64-import-fixture.ts:1:20 compat: import "#compat/x" has no "// compat: <constraint>" comment on its line or the line above
compatibility check failed: 1 violation(s) in 172 source file(s)
```

Added `// compat: the 2024 feed still links the old URLs until it is re-published` above the import →
passed (`c-pass.txt`). The annotation line itself is exempt from the marker scan, but only where it
annotates a compat import.

Fixtures were removed afterwards; the final run on the clean tree is `final-pass.txt`:
`compatibility check passed: 171 source file(s), no compatibility code outside the module.`

## Wiring

- `package.json`: `"check:compat": "node scripts/check-compat.mjs"`.
- `.github/workflows/ci.yml`: step `Check compatibility boundaries` directly after
  `Check design-system guardrails`.
- `docs/compatibility.md`: the rule, how to introduce a compatibility path, how to remove it, and what
  the checker does. `docs/design-system.md`'s command list points at it.

## Checks

| Command | Result |
| --- | --- |
| `pnpm run check:compat` | EXIT=0 (171 source files; one printed transient allow) |
| `pnpm run check:design` | EXIT=0 |
| `pnpm exec knip` | EXIT=0 |
| `pnpm exec vp check` | 1 error in `packages/db/src/migrate.ts:3` — another member's in-flight change, not in this task's scope; the script itself checks clean |

The script is dependency-free and follows the same shape as `check-design.mjs` (explicit allows,
`file:line:column + reason`, notes on stdout and violations on stderr).
