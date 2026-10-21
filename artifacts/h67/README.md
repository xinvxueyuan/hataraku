# H67 MDX guard false positives

## Fix

`assertSafeMdx` now removes code before applying the deny-list:

- fenced blocks opened by 3+ backticks or tildes (up to 3 spaces indent; closing fence must use the same marker and at least the same length; unclosed fences consume to EOF);
- indented code blocks (4 spaces / tab);
- inline code spans, including multi-backtick runs with matching closing runs.

Only then do the existing `import/export/require(/eval(/new Function/process./globalThis/<script` patterns run. Code outside these blocks is still rejected; the security boundary was not widened.

Tests: `packages/api/src/mdx-guard.test.ts` covers backtick and tilde fences, indented fences, four-backtick and nested-fence cases, inline `require`, outside `require` and outside `<script>`. `pnpm run test --project unit` → **91 passed**.

## Full page check

Production URLs `https://www.xinvstar.xyz/blog/<id>` at task start (before this commit was deployed): **12 × 500** = ids **2,7,8,13,14,16,20,22,23,24,30,36**. Table: `production-before.txt`.

After the fix, the same 38 published bodies rendered by the local stack (new code, local DB, `/blog/<id>`):

- **200: 35**
- **404: 1** (id 1, draft)
- **500: 3** (ids 2, 7, 30)

The 9 former false-positive pages **8,13,14,16,20,22,23,24,36** now return 200. Table: `local-after.txt`.

Residual 500s are **not** code-fence guard hits:

- id 2: `Could not parse expression with acorn`
- id 7: `Unexpected character "/" (U+002F) before local name`
- id 30: `UnsafeMdxError: require is not allowed` — `require()` is **outside code** in prose (body line 19), so rejecting it is the required security behavior; content needs backticks/rephrase, not a weaker guard.

Details: `residual-errors.txt`.

**Production post-deploy check** (ff840b0 / `dpl_9d9or1c...` READY): **35 × 200, draft id 1 × 404, 3 × 500 (ids 2, 7, 30)** — identical to the local prediction. Full 38-row table: `production-after.txt`. The 3 residual pages are the H68 content fixes; the guard stays unchanged.

## Gates

- `pnpm run test --project unit`: 91 passed
- `pnpm run ready`: **EXIT=0** (286 tests, e2e 7/7, builds; repo-local untracked `explore/` moved aside for the run because it is not source)
- `check:design` / `check:compat` / `knip`: 0

## Files

- packages/api/src/mdx-guard.ts
- packages/api/src/mdx-guard.test.ts
- artifacts/h67/{README.md,unit.txt,ready.txt,production-before.txt,production-after.txt,local-after.txt,residual-errors.txt,inspect.mjs,inspect-30.mjs}
