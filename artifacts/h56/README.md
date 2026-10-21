# H56 — remove the unused template tokens

H53 flagged the shadcn leftovers as reserved; the captain ruled they are dead template residue and
should be deleted rather than kept "for later". This is that removal.

## What was deleted

From `packages/ui/src/styles/globals.css`, in **three places at once** (a definition without its
bridge, or a bridge without its definition, would leave a dangling reference):

- `:root`: `--chart-1` … `--chart-5`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
  `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`,
  `--sidebar-border`, `--sidebar-ring`;
- `.dark`: the same 13 definitions;
- `@theme inline`: the 13 `--color-*` bridges.

That is 13 semantic tokens (5 chart + 8 sidebar) and 13 bridges, 39 declaration lines in total.

## Token counts

| Measure | Before | After | Change |
| --- | --- | --- | --- |
| semantic colour tokens (`:root` colours) | 32 | 19 | **-13** |
| `:root` declarations | 33 | 20 | -13 |
| `.dark` declarations | 32 | 19 | -13 |
| `@theme inline` colour bridges | 32 | 19 | -13 |
| total declaration lines in the file | 106 | 67 | -39 |
| distinct `--name` tokens in the file | 74 | 48 | -26 (13 tokens + 13 bridges) |

## Proof that nothing rendered with them

Geometry/style fingerprint of every visible element on the home page, the article list and an admin
page — 599 nodes, each with its rect and 13 computed-style values:

| Page | Nodes | Mismatches |
| --- | --- | --- |
| home | 181 | 0 |
| article | 232 | 0 |
| admin | 186 | 0 |
| **total** | **599** | **0** |

`IDENTICAL` — same rects, same computed colours, same radii. The removed tokens had no rendered
consumer, exactly as the `grep` said. After the edit, `git grep` for `--chart`, `--sidebar` and the
sidebar utility names finds nothing outside the README sentence that documents the removal.

## The rule that replaces them

`packages/ui/README.md` no longer has a "reserved tokens" list. It states: **a token exists because
something renders with it today**; a chart palette or a sidebar palette is introduced by the
component that needs it, in the same change (values + bridges). The `--radius-*` entries are
explicitly called out as *not* reserved slots — they are the Tailwind radius scale.

`artifacts/h53/README.md` and `artifacts/h53/verification.json` were updated to point here instead
of claiming the tokens are kept, so the two records do not contradict each other.

## Checks

- `pnpm run check:design` — passed (no hardcoded values introduced; the token file remains the one
  allowlisted raw-colour site).
- `vp check` — 0 errors.
- `knip` — exit 0.
- `pnpm run build` — exit 0.
