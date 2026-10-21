/** One entry in a document's table of contents. */
export interface TocHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

/**
 * The part of the rehype tree this walk reads.
 *
 * The repo does not depend on `hast` types directly, and the walk needs only element tags, a
 * heading id, children, and text. Typing the boundary with that slice keeps the traversal honest:
 * no dictionary lookups, no runtime `typeof` narrowing on values unified already parsed.
 */
interface HastNode {
  children?: HastNode[];
  properties?: { id?: string };
  tagName?: string;
  type: string;
  value?: string;
}

interface HastRoot {
  children?: HastNode[];
  type: string;
}

const textOf = (node: HastNode): string => {
  if (node.value !== undefined) {
    return node.value;
  }

  return (node.children ?? []).map(textOf).join("");
};

const depthOf = (tagName: string | undefined): 0 | 2 | 3 => {
  if (tagName === "h2") {
    return 2;
  }

  if (tagName === "h3") {
    return 3;
  }

  return 0;
};

const walk = (node: HastNode, visit: (node: HastNode) => void) => {
  visit(node);

  for (const child of node.children ?? []) {
    walk(child, visit);
  }
};

/**
 * Collects the headings a document actually rendered, with the ids `rehype-slug` assigned.
 *
 * Reading ids from the rendered tree is the point: a TOC built from the markdown source would carry
 * its own slug implementation and drift from the anchors the page emits (duplicates, punctuation,
 * CJK). This plugin runs after `rehypeSlug`, so the href and the heading id come from one value.
 *
 * The tree is unified's rehype root; the collector is registered in the same plugin list, so the
 * cast at the boundary documents that the pipeline owns the shape.
 */
export const collectHeadings =
  (into: TocHeading[]) => () => (tree: HastRoot) => {
    for (const node of tree.children ?? []) {
      walk(node, (current) => {
        const depth = depthOf(current.tagName);
        const id = current.properties?.id;

        if (depth === 0 || id === undefined || id === "") {
          return;
        }

        into.push({ depth, id, text: textOf(current).trim() });
      });
    }
  };
