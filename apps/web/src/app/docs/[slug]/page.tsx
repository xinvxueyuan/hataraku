import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findDoc, docs } from "#src/server/docs.ts";
import { renderMdx } from "#src/server/mdx.ts";

/**
 * A single doc. The body is markdown from the repository, rendered through the same `renderMdx`
 * pipeline that renders article bodies, so headings, tables, and code blocks behave identically in
 * both places.
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

  const body = await renderMdx(doc.body);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <nav className="text-sm">
        <Link className="text-muted-foreground hover:underline" href="/docs">
          ← 返回文档列表
        </Link>
      </nav>

      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
          {doc.description === undefined ? null : (
            <p className="text-muted-foreground">{doc.description}</p>
          )}
        </header>

        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          data-slot="doc-body"
        >
          {body}
        </div>
      </article>
    </main>
  );
};

export default DocPage;
