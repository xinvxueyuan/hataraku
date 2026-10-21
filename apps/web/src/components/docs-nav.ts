/**
 * Ordering and grouping for the docs navigation.
 *
 * This module is deliberately free of `"use client"`: the server pages build the index and the
 * prev/next chain from it, while the sidebar is a client component. Keeping the two consumers on
 * one implementation is what stops the sidebar order and the pagination order from drifting.
 */
export interface DocLink {
  description?: string;
  order: number;
  section?: string;
  slug: string;
  title: string;
}

const DEFAULT_SECTION = "入门";

const ordered = (docs: readonly DocLink[]): DocLink[] =>
  docs.toSorted(
    (left, right) =>
      left.order - right.order || left.slug.localeCompare(right.slug)
  );

export const orderedDocs = (docs: readonly DocLink[]): DocLink[] =>
  ordered(docs);

export const docsBySection = (
  docs: readonly DocLink[]
): [string, DocLink[]][] => {
  const groups = new Map<string, DocLink[]>();

  for (const doc of ordered(docs)) {
    const section = doc.section ?? DEFAULT_SECTION;
    const items = groups.get(section) ?? [];
    items.push(doc);
    groups.set(section, items);
  }

  return [...groups.entries()];
};
