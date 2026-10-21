/**
 * The public address of a CMS item.
 *
 * A slug is the address only when the author set one; otherwise the numeric id is the address. Both
 * routes resolve with the same rule, so a link and its page cannot disagree about which segment an
 * item lives at. Keep every module link behind this function: a second template elsewhere is how
 * one surface starts pointing at an old address.
 */
export interface ContentRef {
  id: number;
  slug: string | null;
  slugOnly: boolean;
}

export type ContentBase = "/albums" | "/blog";

export const contentSegment = (item: ContentRef): string =>
  item.slug === null || item.slug.trim() === ""
    ? String(item.id)
    : item.slug.trim();

export const contentPath = (
  base: ContentBase,
  item: ContentRef
): `${ContentBase}/${string}` => `${base}/${contentSegment(item)}`;
