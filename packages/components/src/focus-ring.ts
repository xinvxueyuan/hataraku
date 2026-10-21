/**
 * The visible focus ring for in-page links.
 *
 * Pages own their layout, but every interactive element must show where the keyboard focus is; one
 * exported string keeps that from drifting between them. It is deliberately separate from the
 * primitive recipe in @hataraku/ui: a plain anchor is not a Button and does not inherit its ring.
 */
export const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
