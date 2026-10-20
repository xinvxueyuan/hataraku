import { isValidElement } from "react";
import type { ReactNode } from "react";

interface ElementProps {
  readonly children?: ReactNode;
}

/** Children arrive either as one node or as an array of them. */
const isNodeArray = (node: ReactNode): node is readonly ReactNode[] =>
  Array.isArray(node);

const isTag = (node: ReactNode, tag: string): boolean =>
  isValidElement<ElementProps>(node) && node.type === tag;

const childrenOf = (node: ReactNode): ReactNode[] => {
  if (!isValidElement<ElementProps>(node)) {
    return [];
  }

  const { children } = node.props;

  if (isNodeArray(children)) {
    return [...children];
  }

  return children === undefined || children === null ? [] : [children];
};

/** Text in a table cell is a string or a number; a table carries nothing else. */
const isText = (node: ReactNode): node is string | number =>
  typeof node === "string" || typeof node === "number";

const textOf = (node: ReactNode): string => {
  if (isValidElement<ElementProps>(node)) {
    return childrenOf(node).map(textOf).join("");
  }

  if (isNodeArray(node)) {
    return node.map(textOf).join("");
  }

  return isText(node) ? String(node) : "";
};

const cellsOf = (row: ReactNode): string[] =>
  childrenOf(row)
    .filter((cell) => isTag(cell, "td") || isTag(cell, "th"))
    .map((cell) => textOf(cell).trim());

const rowsOf = (section: ReactNode): string[][] =>
  childrenOf(section)
    .filter((row) => isTag(row, "tr"))
    .map(cellsOf);

const findTable = (node: ReactNode): ReactNode => {
  if (isTag(node, "table")) {
    return node;
  }

  for (const child of isNodeArray(node) ? node : childrenOf(node)) {
    const found = findTable(child);

    if (found !== null) {
      return found;
    }
  }

  return null;
};

/**
 * Reads the markdown table a `<Sheet>` element carries into the grid the editor renders.
 *
 * The body is authored as a GFM table rather than as a prop: MDX bodies are compiled with
 * expressions blocked (`blockJS`), so a `rows={[...]}` attribute is stripped before the component
 * ever renders — silently, which is worse than an error. A table is markdown, survives that pass,
 * and reads the way it looks.
 *
 * The elements here are the ones remark-gfm emits (`table` > `thead`/`tbody` > `tr` > `th`/`td`),
 * already expanded on the server by the time this runs.
 */
export const readSheetTable = (children: ReactNode): string[][] => {
  const table = findTable(children);

  if (table === null) {
    throw new Error("A <Sheet> embed needs a markdown table in its body.");
  }

  const rows = childrenOf(table).flatMap((section) => {
    if (isTag(section, "tr")) {
      return [cellsOf(section)];
    }

    return isTag(section, "thead") || isTag(section, "tbody")
      ? rowsOf(section)
      : [];
  });

  if (rows.length === 0) {
    throw new Error("The markdown table in a <Sheet> embed has no rows.");
  }

  return rows;
};
