import "server-only";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactElement } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { rehypePrettyCode } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { assertSafeMdx } from "#src/server/mdx-guard.ts";

/**
 * Renders an article body stored in Postgres as MDX.
 *
 * MDX is not Markdown: it compiles JSX and import/export statements. The body text is written
 * through the admin UI, so it is data an attacker controls the moment an admin session is taken
 * over, and compiling it unchecked would let that attacker run code on the server. Two boundaries
 * keep that from happening:
 *
 * 1. `assertSafeMdx` rejects module syntax and the usual dynamic-evaluation escapes before the
 *    source reaches the compiler. It is a deny-list, so it is a second line of defence rather than
 *    the guarantee.
 * 2. The compiler receives an explicit component map. In MDX a lowercase tag is an intrinsic HTML
 *    element and a capitalised tag is resolved against the components in scope, so an unknown
 *    component is a compile error rather than a call into arbitrary code. Because the map holds
 *    nothing that evaluates a string, a body has no reachable path to execution. This is the
 *    guarantee.
 */

/**
 * Components an article body may use. Empty on purpose: lowercase tags are HTML, and nothing here
 * needs a React component yet. A component added later must render props only, never evaluate a
 * string, or it reopens the boundary this map exists to hold.
 */
const ALLOWED_COMPONENTS = {};

/** Shiki themes that follow the light and dark token sets in the UI package. */
const SHIKI_THEMES = {
  dark: "github-dark-default",
  light: "github-light-default",
};

const CACHE_LIMIT = 64;
const cache = new Map<string, ReactElement>();

/**
 * Compiles a body to React elements, caching by source text.
 *
 * Compilation is pure for a given source, so the key is the source alone. It is a plain Map rather
 * than `unstable_cache` because the body still travels over the API on every request; this only
 * avoids recompiling the same article within one server process.
 */
export const renderMdx = async (source: string): Promise<ReactElement> => {
  const cached = cache.get(source);

  if (cached !== undefined) {
    return cached;
  }

  assertSafeMdx(source);

  const { content } = await compileMDX({
    components: ALLOWED_COMPONENTS,
    options: {
      mdxOptions: {
        rehypePlugins: [
          [
            rehypePrettyCode,
            { defaultLang: "text", keepBackground: false, theme: SHIKI_THEMES },
          ],
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ],
        remarkPlugins: [remarkGfm],
      },
    },
    source,
  });

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();

    if (oldest.done !== true) {
      cache.delete(oldest.value);
    }
  }

  cache.set(source, content);

  return content;
};
