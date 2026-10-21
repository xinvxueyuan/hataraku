# H59 — B1 contrast claim: measured, not reproduced in the steady light theme

The review reports the four 更多 links at **2.68:1** in the light theme. I measured the live page
from computed colours (what WCAG evaluates, not anti-aliased pixels) and the steady light theme
**passes**: 6.02:1. The 2.68 figure is reproducible only while a theme switch is in flight — the
text is read with the dark token while the panel is still painted with the light one.

## What was measured

Playwright, Chromium, 1440×900, the running app on the real database. The effective background is
the first opaque ancestor background; colours are resolved through a canvas (so `lab()`/`oklab()`
serialisations are handled) and converted to WCAG relative luminance.

### Light theme (the page loaded in light, no theme toggling)

| Element | Foreground | Background | Contrast |
| --- | --- | --- | --- |
| 更多 → 归档 / 分类 / 相册 / 工具箱 | `--muted-foreground` | `--popover` (255,255,255) | **6.02** |
| body copy (`--foreground`) | `--foreground` | `--background` | 17.24 |
| headings | `--foreground` | `--background` | 17.30 |
| secondary text / descriptions | `--muted-foreground` | `--background` (251,252,254) | 5.86 |
| dates, footer links | `--muted-foreground` | `--background` | 5.86 |
| tags / badges | `--primary-foreground` | `--primary` | 13.83 |
| placeholder (`::placeholder`) | per input | input background | 17.76 |
| muted text on a `--muted` surface | `--muted-foreground` | `--muted` | 5.38 |
| muted text on `--accent` | `--muted-foreground` | `--accent` | 5.26 |

### Dark theme (no regression)

| Element | Contrast |
| --- | --- |
| 更多 links | 6.62 |
| secondary text / dates / footer | 7.20 |
| headings | 17.20 |
| tags / badges | 13.84 |
| placeholder | 16.14 |

Nothing in the steady light theme falls below 4.5:1. Disabled controls are the only texts below 4.5
in the system (`disabled:opacity-50`), and WCAG 1.4.3 explicitly exempts inactive components; no
disabled control was present on the measured pages.

## Where 2.68 comes from

```
dark  --muted-foreground  oklch(0.70 0.016 270)  on white  → 2.67  ← the review's number
light --muted-foreground  oklch(0.50 0.02 268)    on white  → 6.01  ← the live light theme
```

The colour in the review's own evidence, `oklab(0.699998 …)`, is the **dark** token. Reproduced
deliberately: toggle `.dark` on, then off, and measure while the app's theme provider re-renders —
the panel keeps the light background (255,255,255) while the text already carries the dark token,
which yields exactly 2.68. A WCAG contrast check must use a settled render; a mixed-theme frame is
not a state a reader sees.

## Conclusion: no token change

`--muted-foreground` in the light theme already meets AA on every surface it is used
(5.26–6.02:1). Darkening it now would be an unjustified visual change — and it would not address
the reported number, because that number was not produced by this token on a light background.

If a deliberate safety margin is wanted anyway, `oklch(0.46 0.02 268)` measures 7.13:1 on white
(6.39:1 on `--muted`); that is a design decision, not a defect fix, so it is not applied here.

## Checks

- `pnpm run check:design` — EXIT=0 (no code changed; nothing to bypass).
- `pnpm run build` — EXIT=0.
- `vp check` and `knip` currently fail on **other members' in-flight files** (`packages/api/src/search/orama.ts`,
  `apps/web/src/server/mdx.ts`'s unused `renderMdx`, search tests) — the shared worktree was busy;
  none of those files are in this task's scope and this task changes no code.
- No fingerprint run is needed: no file changed, so no rendered pixel can change.
