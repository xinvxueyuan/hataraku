import emitted from "../../.velite/docs.json";

/**
 * Docs collected by Velite at build time.
 *
 * The type comes from the emitted JSON rather than from Velite's generated declaration file: that
 * file indexes `collections` by key, which collapses to `never` under this repo's
 * `noUncheckedIndexedAccess`. The JSON is the value the app actually reads, so its shape is the
 * honest source of truth and a frontmatter change flows into the pages without a manual type.
 */
export const docs = emitted;

export const findDoc = (slug: string) => docs.find((doc) => doc.slug === slug);
