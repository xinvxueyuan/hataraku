import type { ReactNode } from "react";

/**
 * Wraps the parts of `text` that match the query in `<mark>`.
 *
 * The query is split on whitespace because the server treats each term as a prefix filter; matching
 * each term as a substring highlights exactly the part a prefix hit selected ("Goo" inside
 * "Google"). Text stays React children — this returns elements, never an HTML string — so a query
 * containing `<` or a title containing markup cannot become an injection point.
 */
const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const tokensOf = (query: string): string[] =>
  query
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token !== "");

export const highlight = (text: string, query: string): ReactNode => {
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
      <mark
        className="bg-primary/15 text-foreground rounded-sm px-0.5"
        key={`${part}-${index}`}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};
