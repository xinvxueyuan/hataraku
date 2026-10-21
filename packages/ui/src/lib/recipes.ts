/**
 * The behaviours every interactive primitive shares.
 *
 * These are class fragments, not components: each primitive composes them into its cva base so the
 * order stays visible in the recipe and tailwind-merge still sees real utilities. The point is that
 * focus, invalid and disabled behaviour is defined once — a primitive that invents its own ring or
 * its own disabled opacity is a bug, not a variation.
 *
 * A variant changes appearance (variant/size); these fragments carry behaviour that must not change
 * with appearance. Anything visual belongs in the primitive's cva instead.
 */

/** The focus treatment: a visible ring on the token, never the browser outline. */
export const focusRing =
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none";

/** The invalid treatment, including the stronger ring and the dark-mode border. */
export const invalidState =
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

/** Disabled controls stop receiving the pointer and fade together. */
export const disabledState = "disabled:pointer-events-none disabled:opacity-50";

/** Icons inside a control follow the control: no pointer events, never larger than its slot. */
export const iconSizing =
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/**
 * The height scale shared by text controls (button, input). Icon buttons use the square variants
 * next to it so a row of mixed controls stays on one baseline.
 */
export const controlHeights = {
  default: "h-8",
  lg: "h-9",
  sm: "h-7",
  xs: "h-6",
} as const;

/** The square scale for icon-only controls, matching {@link controlHeights}. */
export const iconSizes = {
  default: "size-8",
  lg: "size-9",
  sm: "size-7",
  xs: "size-6",
} as const;

/**
 * A radius for compact controls, capped so a small control never looks rounder than the control
 * next to it when the theme's radius grows.
 *
 * The classes are written out instead of built from a number: Tailwind scans source text, so an
 * interpolated class would reach the DOM with no CSS behind it and the radius would silently
 * collapse to zero.
 */
export const cappedRadius = {
  /** Small controls (the `sm` size). */
  md: "rounded-[min(var(--radius-md),12px)]",
  /** Compact controls (the `xs` size). */
  sm: "rounded-[min(var(--radius-md),10px)]",
} as const;

/** The rows of a menu (dropdown items, sub-triggers): keyboard focus is the accent surface. */
export const menuItemFocus = "focus:bg-accent focus:text-accent-foreground";

/** Menu rows use `data-disabled` (Base UI's state attribute), not the native `disabled`. */
export const menuItemDisabled =
  "data-disabled:pointer-events-none data-disabled:opacity-50";

/** A label is disabled by its peer/group, because it is not the element that receives the state. */
export const labelDisabled =
  "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50";
