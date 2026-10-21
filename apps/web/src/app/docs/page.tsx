import type { Metadata } from "next";
import Link from "next/link";

import { docsBySection } from "#src/components/docs-nav.ts";
import { docs } from "#src/server/docs.ts";

/**
 * Docs index. The list comes from Velite, which reads the markdown files under `content/docs` at
 * build time; the bodies are rendered by the same MDX pipeline the database-backed articles use.
 * This page is part of the docs lifecycle: it never reads a database.
 */

export const metadata: Metadata = {
  description: "站点的实现文档。",
  title: "文档",
};

const DocsPage = () => {
  const groups = docsBySection(docs);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">文档</h1>
        <p className="text-muted-foreground">
          站点的实现说明，随仓库一起演进；新增一篇只需要加一个 markdown 文件。
        </p>
      </header>

      <div className="flex flex-col gap-8" data-slot="docs-list">
        {groups.map(([section, items]) => (
          <section className="flex flex-col gap-3" key={section}>
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {section}
            </h2>
            <ul className="flex flex-col gap-3">
              {items.map((doc) => (
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
          </section>
        ))}
      </div>
    </div>
  );
};

export default DocsPage;
