# H53 — the design system's foundation

`packages/ui` now has a written token contract, one shared behaviour recipe, an explicit CSS layer
contract, a proof that it does not depend on Next, a controlled icon set, and a re-skin
demonstration that changes the whole site without touching a single component.

## 1. Token contract

`src/styles/globals.css` is still the single place tokens live (74 declarations), now organised and
documented:

- the header states the layer contract and the "add a token: value + bridge" rule;
- `@theme inline` is grouped into typography, shape, state, data-visualisation and application
  chrome, with the bridge explained (`--color-*` → `bg-*`/`text-*`/`border-*`, `--radius-*` →
  `rounded-*`, `--font-*` → `font-*`);
- `:root` and `.dark` are grouped into surfaces, text, actions, feedback, lines, shape, data
  visualisation and application chrome — same names, same values, only comments and ordering moved.

Verified mechanically: the old and new file declare the same **74** token names, with **zero**
missing, added or value-changed entries.

**Flagged for the captain** (defined but unused today, kept deliberately — not deleted):

- `--chart-1` … `--chart-5` — no chart consumes them yet.
- `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`,
  `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` — the
  shadcn sidebar primitive is not installed.
- `--radius-sm/lg/xl/2xl/3xl/4xl` are unused **by name** but load-bearing: they are the Tailwind
  radius scale that `rounded-sm`/`rounded-lg`/… resolve through. `--radius` itself is the one value
  a re-skin edits.

## 2. Shared base plus variants

`src/lib/recipes.ts` is the shared behaviour layer. Each primitive composes these fragments into
its cva base, so focus, invalid and disabled behaviour is defined once:

| Fragment | Meaning |
| --- | --- |
| `focusRing` | visible ring on the token, no browser outline |
| `invalidState` | `aria-invalid` border/ring, including the dark-mode variant |
| `disabledState` | `disabled:pointer-events-none` + `opacity-50` |
| `iconSizing` | icons follow their control (no pointer events, max `size-4`) |
| `controlHeights` / `iconSizes` | the one height scale shared by text and icon controls |
| `cappedRadius` | compact radii capped against the theme's radius — written out as literals because Tailwind scans source text |
| `menuItemFocus` / `menuItemDisabled` | menu-row behaviour (`data-disabled`, not native `disabled`) |
| `labelDisabled` | a label follows its peer/group, since it never receives the state itself |

Six primitives were moved onto it: button, badge, input, checkbox, label and dropdown-menu. The
base and variant *appearance* stayed in each primitive's cva; only behaviour was factored out.
`README.md` documents the contract and the eight rules for adding a component.

## 3. CSS isolation

- One entry: `grep` for CSS imports in `apps/web/src` finds exactly one —
  `apps/web/src/app/layout.tsx: import "@hataraku/ui/globals.css";`. No application file imports a
  fragment from the package.
- `globals.css` declares the layer contract: `base` holds element defaults only; `components` is a
  documented, **empty** reserved layer (so an application's utility always beats a primitive);
  `utilities` is where all primitive and application styling lives.
- No selector in the package describes application structure (`main > div`, `section + section`) —
  the file contains only token declarations, the theme bridge and the base layer.

## 4. Decoupling from Next

- `grep -r "next/" packages/ui` → **0 matches**; `grep -rn "next" packages/ui/src` shows only one
  dependency: `next-themes` in `sonner.tsx`. `next-themes` is not `next/*` and works with any
  React renderer; it is the one place the package knows how the app stores its theme. The README
  records the future step of lifting that hook into the application and passing `theme` to
  `<Toaster theme={…} />` — deliberately not done here because it changes an application's code.
- The package imports no `next/link`, `next/image`, `next/navigation`, middleware or proxy helper.

## 5. Icons belong to the system

`src/icons.ts` exports a reviewed set by name (never `export *`), and the primitives now take their
glyphs from it (checkbox, dropdown, sonner).

Exported: `Check`, `CircleCheck`, `Info`, `Lightbulb`, `Loader2`, `OctagonAlert`, `OctagonX`,
`TriangleAlert`, `ChevronDown`, `ChevronRight`, `Menu`, `Copy`, `Moon`, `Sun`, `Trash2`,
`FolderGit2`, `Images`, `Smartphone`, `UserRound`, plus the `LucideIcon` type and `iconScale`.

Sizing rule: controls size icons through `iconSizing`, standalone icons use `iconScale`
(`sm`/`md`/`lg` → `size-3.5`/`size-4`/`size-5`); a numeric `size={16}` is a bug. Colour is
`currentColor` from a text token. The alias map for the application migration (`MoonIcon`→`Moon`,
`AlertTriangle`→`TriangleAlert`, …) is in `packages/ui/README.md`.

## 6. Re-skin proof: tokens only, components untouched

The demonstration changed **only** these token values in `globals.css`: `--primary` and
`--primary-foreground` (light and dark) to a green scale, `--ring` to match, and `--radius` from
`0.75rem` to `1.25rem`. No file under `apps/` was edited (`git status -- packages/ui/src` /
`apps/web/src` were checked around the experiment).

Measured on three surfaces (home, article list, admin) with a geometry/style fingerprint of every
visible element:

| Comparison | Nodes | Layout (rect) diffs | Style diffs | Result |
| --- | --- | --- | --- | --- |
| baseline → final (recipes + icons) | 599 | **0** | **0** | identical |
| final → re-skinned | 599 | **0** | **144** | same layout, new colours/radii |
| final → restored | 599 | **0** | **0** | identical |

The re-skinned fingerprints show e.g. a nav pill's radius `9.6px → 16px` (the `--radius` scale) and
the primary/accent ink moving from `lab(40.25 29.9 -70.7)` (purple) to
`lab(49.84 -52 26.97)` (green). After restoring, the file's SHA-256 equals the original
(`6F6B0E81…`), and the fingerprints are identical to the baseline again.

Screenshots: `screenshots/baseline-*.png`, `after-*.png`, `reskin-*.png`, `restored-*.png`
(home / article / admin each).

## 7. Guardrail (proposal only)

The check itself belongs to another task (H55). Proposal:

- `scripts/check-tokens.mjs` scanning `apps/**/*.{ts,tsx,css}` and `packages/**/*.{ts,tsx}` for
  colour literals (`#rgb`, `rgb(`, `hsl(`, `oklch(`) and for colour-bearing inline `style`, with an
  allowlist: this stylesheet (the tokens themselves) and `apps/web/src/app/api/og/route.tsx`
  (satori renders an image and cannot use CSS classes or tokens).
- An oxlint rule is the editor-time complement; it needs the same allowlist and should match class
  strings only, or it fires on the token block and on data URLs.
- False positives to design around: inline `style` that only maps a token
  (`style={{ "--x": "var(--radius)" }}`), SVG `fill="#fff"` in components that must render an icon,
  third-party class names containing a colour word, and the `<style>` satori emits.

## Icon entry point

`packages/ui/package.json` gains one export:

```json
"./icons": "./src/icons.ts"
```

so a consumer writes `import { Info } from "@hataraku/ui/icons"`. With that export in place Knip
sees the module as a package entry point and no `knip.json` entry is needed (the first attempt did
add one; Knip reported it as redundant once the export existed, and it was removed).

## Verification environment

- `vp fmt`/`vp check --no-fmt` on `packages/ui` — clean; the production `next build` compiled the
  changed primitives.
- The visual evidence ran against a dev server with the real local database, at 1440×900.
- The shared worktree carried other members' in-flight changes (package manifests, CI workflow), so
  the repo-wide `pnpm run ready` could not be read as a verdict for this change; the scoped checks
  above plus CI on a clean checkout are the gate.