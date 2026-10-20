import type { z } from "velite";
import { defineCollection, defineConfig, s } from "velite";

/**
 * Docs are files under version control, not rows in the database.
 *
 * Article bodies live in Postgres and are rendered by `renderMdx` from the web app. Docs use the
 * same renderer and the same MDX plugins so the two do not drift: Velite's job here is only to
 * discover the files, validate their frontmatter, and hand the body over as a string. Compiling the
 * body inside Velite would create a second rendering path with its own plugin list.
 */
const docsSchema = s.object({
  /** Raw markdown body, rendered by the app's MDX pipeline rather than by Velite. */
  body: s.raw(),
  description: s.string().max(999).optional(),
  order: s.number().default(0),
  /** Derived from the file path, so a doc's URL follows its location. */
  slug: s.path(),
  title: s.string().max(99),
  updatedAt: s.isodate().optional(),
});

/**
 * The generated `.velite/index.d.ts` indexes `collections` by key, which collapses to `never`
 * under this repo's `noUncheckedIndexedAccess`. The schema is the source of truth, so the type is
 * derived from it here and the app assigns the emitted JSON to that type instead of asserting it.
 */
export type Doc = z.infer<typeof docsSchema>;

const docs = defineCollection({
  name: "Doc",
  pattern: "**/*.md",
  schema: docsSchema,
});

export default defineConfig({
  collections: { docs },
  root: "content/docs",
});
