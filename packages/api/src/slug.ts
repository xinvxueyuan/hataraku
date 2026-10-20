/**
 * URL slugs for the write paths.
 *
 * Two rules matter and both are pinned by the unit test: a slug is lowercase ASCII with single
 * dashes, and a source that has no ASCII at all (a Chinese title, typically) still produces a
 * stable, readable slug from a date and a random suffix rather than an empty string.
 */

const collapse = (input: string): string =>
  input
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/-{2,}/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, 80);

const randomSuffix = (): string => Math.random().toString(36).slice(2, 6);

const pad = (value: number): string => String(value).padStart(2, "0");

/** A slug from `input`, or `<prefix>-<yyyymmdd>-<rand>` when the text has no ASCII to keep. */
export const slugify = (
  input: string,
  prefix = "item",
  now: Date = new Date()
): string => {
  const base = collapse(input);

  if (base !== "") {
    return base;
  }

  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  return `${prefix}-${stamp}-${randomSuffix()}`;
};

/** An explicit slug goes through the same collapse; an empty one falls back to the source field. */
export const resolveSlug = (
  raw: string | null | undefined,
  fallbackSource: string,
  prefix = "item",
  now: Date = new Date()
): string => {
  const value = (raw ?? "").trim();

  return slugify(value === "" ? fallbackSource : value, prefix, now);
};
