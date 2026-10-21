import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { orderedDocs } from "#src/components/docs-nav.ts";
import { DocsToc } from "#src/components/docs-toc.tsx";
import { findDoc, docs } from "#src/server/docs.ts";
import { renderMdxWithToc } from "#src/server/mdx.ts";

/**
 * A single doc. The body is markdown from the repository, rendered through the same `renderMdx`
 * pipeline that renders article bodies, so headings, tables, and code blocks behave identically in
 * both places.
 *
 * The table of contents comes from that same compilation: its headings carry the ids rehype-slug
 * assigned to the rendered elements, so the anchors cannot drift from the page.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const generateStaticParams = () =>
  docs.map((doc) => ({ slug: doc.slug }));

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { slug } = await params;
  const doc = findDoc(slug);

  return doc === undefined
    ? { title: "文档不存在" }
    : { description: doc.description, title: doc.title };
};

const DocPage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const doc = findDoc(slug);

  if (doc === undefined) {
    notFound();
  }

  const { content, headings } = await renderMdxWithToc(doc.body);
  const ordered = orderedDocs(docs);
  const index = ordered.findIndex((entry) => entry.slug === doc.slug);
  const previous = index > 0 ? ordered[index - 1] : undefined;

  const next =
    index !== -1 && index < ordered.length - 1 ? ordered[index + 1] : undefined;

  return (
    <div className="flex gap-10">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <nav aria-label="面包屑" className="text-muted-foreground text-sm">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                className="hover:text-foreground hover:underline"
                href="/docs"
              >
                文档
              </Link>
            </li>
            {doc.section === undefined ? null : (
              <>
                <li aria-hidden="true">/</li>
                <li>{doc.section}</li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li>
              <span aria-current="page" className="text-foreground">
                {doc.title}
              </span>
            </li>
          </ol>
        </nav>

        <article className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            {doc.description === undefined ? null : (
              <p className="text-muted-foreground">{doc.description}</p>
            )}
          </header>

          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            data-slot="doc-body"
          >
            {content}
          </div>
        </article>

        {previous === undefined && next === undefined ? null : (
          <nav
            aria-label="上一篇与下一篇"
            className="grid gap-3 border-t pt-6 text-sm sm:grid-cols-2"
          >
            {previous === undefined ? (
              <span />
            ) : (
              <Link
                className="hover:bg-accent flex flex-col gap-1 rounded-lg border p-3 transition-colors"
                href={`/docs/${previous.slug}`}
                rel="prev"
              >
                <span className="text-muted-foreground text-xs">← 上一篇</span>
                <span className="font-medium">{previous.title}</span>
              </Link>
            )}
            {next === undefined ? null : (
              <Link
                className="hover:bg-accent flex flex-col gap-1 rounded-lg border p-3 text-right transition-colors sm:col-start-2"
                href={`/docs/${next.slug}`}
                rel="next"
              >
                <span className="text-muted-foreground text-xs">下一篇 →</span>
                <span className="font-medium">{next.title}</span>
              </Link>
            )}
          </nav>
        )}
      </div>

      <aside className="hidden w-48 shrink-0 xl:block">
        <div className="sticky top-24">
          <DocsToc headings={headings} />
        </div>
      </aside>
    </div>
  );
};

export default DocPage;
