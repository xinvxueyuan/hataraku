import type { Metadata } from "next";
import Link from "next/link";

import { docs } from "#src/server/docs.ts";

/**
 * Docs index. The list comes from Velite, which reads the markdown files under `content/docs` at
 * build time; the bodies are rendered by the same MDX pipeline the database-backed articles use.
 */

export const metadata: Metadata = {
  description: "站点的实现文档。",
  title: "文档",
};

const DocsPage = () => {
  const ordered = [...docs].toSorted((left, right) => left.order - right.order);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">文档</h1>
        <p className="text-muted-foreground">
          站点的实现说明，随仓库一起演进。
        </p>
      </header>

      <ul className="flex flex-col gap-3" data-slot="docs-list">
        {ordered.map((doc) => (
          <li key={doc.slug}>
            <Link
              className="hover:bg-accent flex flex-col gap-1 rounded-lg border p-4 transition-colors"
              href={`/docs/${doc.slug}`}
            >
              <span className="font-medium">{doc.title}</span>
              {doc.description === undefined ? null : (
                <span className="text-muted-foreground text-sm">
                  {doc.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default DocsPage;
