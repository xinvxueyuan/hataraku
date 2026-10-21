import "server-only";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactElement } from "react";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { rehypePrettyCode } from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { assertSafeMdx } from "@hataraku/api/mdx-guard";
import { Admonition } from "@hataraku/components/admonition";
import { CodeBlock } from "@hataraku/components/code-block";

import { Sheet } from "#src/components/sheet.tsx";
import { expandAdmonitions } from "#src/lib/markdown/admonitions.ts";
import { collectHeadings } from "#src/lib/markdown/headings.ts";
import type { TocHeading } from "#src/lib/markdown/headings.ts";

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
 * Components an article body may use. Lowercase tags are HTML, so only components that need to be
 * React belong here. A component added later must render props only and never evaluate a string, or
 * it reopens the boundary this map exists to hold.
 *
 * `Sheet` reads the markdown table in its body into a read-only Univer canvas. `Admonition` is the
 * target of the `:::note` family and renders only its type, title, and children. `pre` wraps a
 * highlighted code block so it can offer copy-to-clipboard; it renders the element it is given and
 * never interprets its text.
 *
 * Note that the compiler runs with expressions blocked, which strips `rows={[…]}` attribute values
 * without a warning, so a component here takes its data from children or string attributes, never
 * from an expression. The editor itself arrives through `next/dynamic` with `ssr: false`, which keeps
 * the engine out of the server render and out of the first bundle.
 */
const ALLOWED_COMPONENTS = { Admonition, Sheet, pre: CodeBlock };

/** Shiki themes that follow the light and dark token sets in the UI package. */
const SHIKI_THEMES = {
  dark: "github-dark-default",
  light: "github-light-default",
};

const CACHE_LIMIT = 64;

interface RenderedBody {
  content: ReactElement;
  headings: TocHeading[];
}

const cache = new Map<string, RenderedBody>();

/**
 * Compiles a body to React elements plus the headings it rendered, caching by source text.
 *
 * Compilation is pure for a given source, so the key is the source alone. It is a plain Map rather
 * than `unstable_cache` because the body still travels over the API on every request; this only
 * avoids recompiling the same article within one server process.
 */
export const renderMdxWithToc = async (
  source: string
): Promise<RenderedBody> => {
  const cached = cache.get(source);

  if (cached !== undefined) {
    return cached;
  }

  // The directive syntax is expanded first so a body without one reaches the compiler unchanged.
  const expanded = expandAdmonitions(source);
  assertSafeMdx(expanded);

  const headings: TocHeading[] = [];

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
          // After the slug plugin, so the collected ids are exactly the rendered ones.
          collectHeadings(headings),
        ],
        remarkPlugins: [remarkGfm],
      },
    },
    source: expanded,
  });

  const rendered = { content, headings };

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();

    if (oldest.done !== true) {
      cache.delete(oldest.value);
    }
  }

  cache.set(source, rendered);

  return rendered;
};
