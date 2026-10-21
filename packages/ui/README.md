# @hataraku/ui — the design system

Primitives (shadcn/base-ui) and the one stylesheet that defines the design tokens. Applications
consume this package and never restyle it by editing it: a re-skin edits the token values in
`src/styles/globals.css`, and nothing else in the repository changes.

```
src/components/*   primitives: button, badge, card, checkbox, dropdown-menu, input, label, sonner
src/lib/recipes.ts shared behaviour fragments (focus, invalid, disabled, control heights, radii)
src/styles/globals.css  the only stylesheet: tokens + base layer
```

## The token contract

Every colour, radius and font flows through the tokens in `src/styles/globals.css`. A component
never names a raw colour, and a rule never hardcodes one.

**The layers** (declared in that file):

| Layer        | Holds                                                                   | Written by                      |
| ------------ | ----------------------------------------------------------------------- | ------------------------------- |
| `base`       | element defaults (`body`, `*`, `::selection`)                           | this package only               |
| `components` | reserved for class rules that must beat utilities — **empty today**     | this package, `ui-` prefix only |
| `utilities`  | Tailwind utilities, the only layer primitives and applications write in | everywhere                      |

While `components` is empty, an application's `className` always wins over a primitive's styling,
because there is no component-layer specificity to fight. If a rule ever needs to beat a utility,
it goes there and is named `ui-*` so it is greppable.

**The groups** inside `:root` and `.dark`:

- _Surfaces_ — `--background`, `--card`, `--popover` (+ their `-foreground` inks).
- _Text_ — `--foreground`, `--card-foreground`, `--popover-foreground`.
- _Actions_ — `--primary`, `--secondary`, `--accent`, `--muted` (+ inks).
- _Feedback_ — `--destructive`, `--success`.
- _Lines_ — `--border`, `--input`, `--ring`.
- _Shape_ — `--radius`; the reachable scale (`--radius-sm` … `--radius-4xl`) is derived from it in
  the theme bridge, so `rounded-lg` and friends follow a re-skin automatically.
- _Data visualisation_ — `--chart-1` … `--chart-5`.
- _Application chrome_ — `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
  `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`,
  `--sidebar-border`, `--sidebar-ring`.

**Reserved / currently unused tokens** (measured across `apps/web/src`, `apps/mobile/src` and this
package): `--chart-1` … `--chart-5` and the eight `--sidebar-*` tokens have no consumer yet. They are
part of the shadcn contract and are kept for the surfaces they will serve; they are not dead by
accident. The `--radius-*` entries are also unused _by name_, but they are the Tailwind radius scale
that `rounded-sm`/`rounded-lg`/`rounded-xl` resolve through, so they are load-bearing.

**Adding a token**: add the value under `:root` and `.dark`, then add its bridge in
`@theme inline` (`--color-*` for colours, `--radius-*` for shape). A token without a bridge is
invisible to Tailwind; a utility without a token hardcodes a colour.

## CSS isolation

- The package ships **one** stylesheet, `@hataraku/ui/globals.css`, and an application imports it
  **once**, in its root layout (`apps/web/src/app/layout.tsx`). There is no per-component CSS to
  import, and no application file may import a fragment from this package.
- The stylesheet contains token declarations, one `@theme inline` bridge and the `base` layer. No
  selector in it describes the application's structure — no `main > div`, no `section + section`.
  A package that knows an application's DOM cannot be reused or restyled safely.
- `@source` lists the application roots so Tailwind sees the classes used there; it does not emit
  application CSS.
- Dark mode is the `.dark` class on `<html>`, declared once through `@custom-variant`. A primitive
  never checks the theme.

## Adding a component

1. `pnpm dlx shadcn@latest add <name>` from `packages/ui`, or copy the shadcn/base-ui primitive.
2. Keep `data-slot="<name>"` on the root (and on the parts that app code may target). It is the
   stable hook for tests and styling; class names are not.
3. Express appearance with `cva`: one base, a `variant` axis for meaning and a `size` axis for
   scale. Export the variants so callers can compose them (`buttonVariants`).
4. Compose behaviour from `src/lib/recipes.ts` instead of writing it again:
   `focusRing`, `invalidState`, `disabledState`, `iconSizing`, `controlHeights`, `iconSizes`,
   `cappedRadius`, `menuItemFocus`, `menuItemDisabled`, `labelDisabled`.
   Focus, invalid and disabled are behaviour: a primitive that invents its own ring or opacity is a
   bug, not a variant.
5. Use semantic utilities only (`bg-primary`, `text-muted-foreground`, `border-border`,
   `rounded-lg`). No `#hex`, no `rgb()`, no `oklch()` in a component; those exist only in the token
   file.
6. Don't add CSS. No `<style>`, no global selector, no `!important`. If a rule is unavoidable, use
   the `components` layer with a `ui-` name.
7. **Write class names as literals.** Tailwind scans source text, so a class assembled from a
   variable (`rounded-{[...]}`) reaches the DOM with no CSS behind it and the property silently
   collapses. That is why `cappedRadius` is an object of written-out classes, not a function.
8. Don't import the application's world: no `next/*` (no `next/link`, `next/image`,
   `next/navigation`), no middleware/proxy/route helpers, no `apps/web` module. Links and routing
   are the application's job; this package renders markup.
9. Keep it accessible: keyboard reachable, visible focus, `aria-` state passed through to
   Base UI/shadcn primitives rather than re-implemented.

## Icons

Icons are visual assets, so the system owns them: an application imports from
`@hataraku/ui/icons` and never from `lucide-react` directly. `src/icons.ts` re-exports a reviewed
set by name (no `export *`), and the primitives already take their glyphs from it.

The current set:

| Group                  | Icons                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Feedback and status    | `Check`, `CircleCheck`, `Info`, `Lightbulb`, `Loader2`, `OctagonAlert`, `OctagonX`, `TriangleAlert` |
| Navigation             | `ChevronDown`, `ChevronRight`, `Menu`                                                               |
| Actions and appearance | `Copy`, `Moon`, `Sun`, `Trash2`                                                                     |
| Entities               | `FolderGit2`, `Images`, `Smartphone`, `UserRound`                                                   |

Rules:

- **Add an icon here**, one line in `src/icons.ts` (the list stays alphabetical). Never import
  `lucide-react` in a component — not in this package, not in an application.
- **Size through tokens**: a control sizes its icons with the `iconSizing` recipe; a standalone
  icon uses `iconScale` (`sm`/`md`/`lg` → `size-3.5`/`size-4`/`size-5`). The classes resolve
  against the spacing scale, so a re-skin moves them. A numeric `size={16}` bypasses the scale and
  is a bug.
- **Colour through tokens**: icons inherit `currentColor`; set it with a text token utility on the
  parent (`text-muted-foreground`), never with a fill/stroke literal.
- The current applications still import `lucide-react` directly in a handful of places; migrating
  them to `@hataraku/ui/icons` is the components task, not this package's. The alias map for that
  migration: `MoonIcon`→`Moon`, `SunIcon`→`Sun`, `Trash2Icon`→`Trash2`, `CheckIcon`→`Check`,
  `ChevronRightIcon`→`ChevronRight`, `CircleCheckIcon`→`CircleCheck`, `InfoIcon`→`Info`,
  `TriangleAlertIcon`/`AlertTriangle`→`TriangleAlert`, `OctagonXIcon`→`OctagonX`,
  `Loader2Icon`→`Loader2`.

## Decoupling from Next

`grep -r "next/" packages/ui` returns nothing: the package imports no Next module. The one
Next-adjacent dependency is `next-themes` in `sonner.tsx`, used only to read the current theme for
the toaster. It is not `next/*` and it works with any React renderer, but it is the one place where
the package knows how the application stores its theme. A future step is to lift that hook into the
application and pass `theme` to `<Toaster theme={…} />`; the Toaster's contract already accepts it,
so the change is on the application side and is deliberately not done here.

## Guardrail (proposal, not implemented)

The rule this package relies on — no hardcoded design values in application code — is only a
convention today. The proposal, for the task that owns the check:

- `scripts/check-tokens.mjs` (repo root, run in `vp run ready`): scan `apps/**/*.{ts,tsx,css}` and
  `packages/**/*.{ts,tsx}` for colour literals (`#rgb`, `rgb(`, `hsl(`, `oklch(`) and for
  `style={{ color: … }}` / `background: …` outside the allowlist. Allowlist: this stylesheet, and
  `apps/web/src/app/api/og/route.tsx` (satori renders to an image and cannot use CSS classes).
- An oxlint custom rule is the alternative if we want editor-time feedback; it needs the same
  allowlist and a narrower matcher (class strings only), otherwise it fires on data URLs and on the
  `:root` token block.
- False positives to design around: inline `style` that only maps a token
  (`style={{ "--x": "var(--radius)" }}`), SVG `fill="#fff"` inside a component that must render an
  icon, and third-party class names that happen to contain a colour word.
