/**
 * The icon set the design system exposes.
 *
 * Icons are visual assets, so they belong here rather than in each application: a component that
 * renders a warning triangle must not decide which library draws it. This module is the single
 * source — an application imports from `@hataraku/ui/icons` and never from `lucide-react` directly,
 * which keeps the icon library an implementation detail of the design system.
 *
 * Adding an icon is one line here: add it to the export list below (keep the list alphabetical).
 * Do not `export * from "lucide-react"`: the point is a reviewed set whose weight and meaning the
 * system owns, not the library's 1500 glyphs.
 *
 * Sizing and colour come from the surrounding tokens and utilities, never from a numeric prop:
 * a control sizes its icons through the `iconSizing` recipe in `lib/recipes.ts`, and standalone
 * icons use {@link iconScale}, whose classes resolve against the spacing scale. Passing
 * `size={16}` bypasses the token scale and is a bug, not a shortcut.
 */

/* Feedback and status. */
export {
  Check,
  CircleCheck,
  Info,
  Lightbulb,
  Loader2,
  OctagonAlert,
  OctagonX,
  TriangleAlert,
} from "lucide-react";

/* Navigation and disclosure. */
export { ChevronDown, ChevronRight, Menu } from "lucide-react";

/* Actions and appearance. */
export { Copy, Moon, Sun, Trash2 } from "lucide-react";

/* Entities the site writes about. */
export { FolderGit2, Images, Smartphone, UserRound } from "lucide-react";

export type { LucideIcon } from "lucide-react";

/**
 * The three sizes an icon is allowed to render at. They are utilities, not pixel values: the
 * spacing scale is tokenised, so a re-skin can move them without touching a component.
 */
export const iconScale = {
  lg: "size-5",
  md: "size-4",
  sm: "size-3.5",
} as const;
