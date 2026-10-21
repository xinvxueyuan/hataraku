import type { ReactNode } from "react";

/**
 * Wraps the parts of `text` that match a query in `<mark>`.
 *
 * The query is split on whitespace because callers treat each term as a prefix filter; matching
 * each term as a substring highlights exactly the part a prefix hit selected ("Goo" inside
 * "Google"). Text stays React children — this returns elements, never an HTML string — so a query
 * containing `<` or a title containing markup cannot become an injection point.
 */
export interface HighlightMatch {
  length: number;
  start: number;
}

const MARK_CLASS = "bg-primary/15 text-foreground rounded-sm px-0.5";

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const tokensOf = (query: string): string[] =>
  query
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token !== "");

export const highlightMatches = (
  text: string,
  query: string,
  matches?: readonly HighlightMatch[]
): ReactNode => {
  if (matches !== undefined) {
    const nodes: ReactNode[] = [];
    let cursor = 0;

    for (const match of matches.toSorted(
      (left, right) => left.start - right.start
    )) {
      if (match.start < cursor || match.start + match.length > text.length) {
        continue;
      }

      if (match.start > cursor) {
        nodes.push(text.slice(cursor, match.start));
      }

      nodes.push(
        <mark className={MARK_CLASS} key={`mark-${match.start}`}>
          {text.slice(match.start, match.start + match.length)}
        </mark>
      );
      cursor = match.start + match.length;
    }

    if (cursor < text.length) {
      nodes.push(text.slice(cursor));
    }

    return nodes;
  }

  const tokens = tokensOf(query);

  if (tokens.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "giu");
  const parts = text.split(pattern);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark className={MARK_CLASS} key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};
