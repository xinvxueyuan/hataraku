/**
 * URL parsing for the admin lists.
 *
 * The query string is the only source of truth for "what the list currently shows": the page parses
 * it, hands the result to the procedure, and every link keeps it. Two consequences worth stating:
 * pasting a link reproduces the view, and a malformed value cannot crash the page — a page number
 * that is not a positive integer falls back to 1, while the *API* still rejects such a value when a
 * caller sends it directly (that difference is pinned by the integration tests).
 */

const firstValue = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

/** The search term, trimmed and bounded; an empty box means "no search". */
export const readAdminQuery = (
  value: string | string[] | undefined
): string | undefined => {
  const raw = firstValue(value)?.trim();

  return raw === undefined || raw === "" ? undefined : raw.slice(0, 120);
};

/** A page number from the URL; anything that is not a positive integer is page 1. */
export const readAdminPage = (value: string | string[] | undefined): number => {
  const parsed = Number(firstValue(value) ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

/** A value that must be one of a closed set; anything else falls back to the default. */
export const readAdminChoice = <T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T
): T => {
  const raw = firstValue(value);

  return allowed.find((candidate) => candidate === raw) ?? fallback;
};

/** An optional filter: a value from the closed set, or `undefined` for "any". */
export const readAdminFilter = <T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[]
): T | undefined => {
  const raw = firstValue(value);

  return allowed.find((candidate) => candidate === raw);
};

/** A tri-state filter: `true`, `false`, or absent for "both". */
export const readAdminBoolean = (
  value: string | string[] | undefined
): boolean | undefined => {
  const raw = firstValue(value);

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  return undefined;
};

/** A link that keeps the search, the filters and the sort while moving to another page. */
export const adminListHref = (
  path: string,
  params: Readonly<Record<string, boolean | number | string | undefined>>
): string => {
  const search = new URLSearchParams();

  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }

    search.set(name, String(value));
  }

  const query = search.toString();

  return query === "" ? path : `${path}?${query}`;
};
