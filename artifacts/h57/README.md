# H57 — the last two design values become tokens

`pnpm run check:design` carried 24 exceptions. Two of them were not geometry but real design values,
parked with the note "H53 owns the token replacement":

```
packages/ui/src/components/button.tsx:34    text-[0.8rem]
packages/ui/src/components/checkbox.tsx:14  rounded-[4px]
```

Both now come from tokens, and both exception entries are gone: **24 → 22**.

## 1. The compact type scale: `--text-control`

`@theme inline` gains:

```css
--text-control: 0.8rem;
--text-control--line-height: 1.5;
```

and `button.tsx` uses `text-control` for its `sm` size.

Two findings while doing it:

- **A text utility always writes a line-height.** With only `--text-control` defined, Tailwind's
  default ratio turned the compact button's 19.2px leading into 18.2857px and moved it by a pixel.
  The explicit `1.5` restores 12.8px × 1.5 = **19.2px**, identical to the inherited value.
- **Two `text-*` utilities on one element are resolved by stylesheet order, not by the class
  list.** The button base had `text-sm` and the `sm` size added `text-control`; `text-sm` won in
  the generated CSS (14px), even though the size variant comes later in the class string. The base
  no longer sets a font size: each size variant owns one (`default`/`lg`/`icon*` → `text-sm`, `xs` →
  `text-xs`, `sm` → `text-control`). That is what the fingerprint caught — a 14px regression that no
  type checker or lint rule would have reported.

## 2. The checkbox corner: `--radius-control`

First checked whether an existing step is exactly 4px: it is not — the scale derives from
`--radius: 0.75rem`, so `--radius-sm` is 7.2px, `--radius-md` 9.6px, and Tailwind's untouched
`rounded-xs` is 2px. A new semantic token:

```css
--radius-control: min(var(--radius-md), 0.25rem);
```

`checkbox.tsx` uses `rounded-control`. It reuses `--radius-md` (so the corner participates in the
scale) but is capped at 4px: a 16px box with a 12px theme radius would otherwise become a circle.
No scale point was invented above `sm`.

## Verification

**Exact values, before → after** (`artifacts/h57/style-probe-*.json`):

| Element | Property | Before | After |
| --- | --- | --- | --- |
| checkbox | border-radius | 4px | **4px** |
| compact (`sm`) button in an admin list | font-size | 12.8px | **12.8px** |
| same button | line-height | 19.2px | **19.2px** (from the fingerprint) |
| default button | font-size | 14px | 14px |

**599-node geometry/style fingerprint** (home 181, article 232, admin 186), before vs after:
**IDENTICAL — 0 rect diffs, 0 computed-style diffs**. Every element keeps its position, colour and
metric.

## Checks

- `pnpm run check:design` — EXIT=0, **22 allows** (was 24; the two entries removed from
  `scripts/check-design.mjs`, the classes no longer appear).
- `vp check` — 0 errors (220 files).
- `knip` — EXIT=0.
- `pnpm run build` — EXIT=0.

## Files

- `packages/ui/src/styles/globals.css` — the two tokens and their bridges.
- `packages/ui/src/components/button.tsx` — `text-control`, size variants own their font size.
- `packages/ui/src/components/checkbox.tsx` — `rounded-control`.
- `packages/ui/README.md` — the type-scale and control-radius entries, plus the two hazards above.
- `scripts/check-design.mjs` — the two exception rows deleted.
