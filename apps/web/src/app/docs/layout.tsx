import type { ReactNode } from "react";

import { DocsMobileNav, DocsSidebar } from "#src/components/docs-sidebar.tsx";
import { docs } from "#src/server/docs.ts";

/**
 * The docs shell.
 *
 * The sidebar is derived from `content/docs` at render time: adding a markdown file is the whole
 * publishing step for a new page, which is the lifecycle this subsection owns (version-controlled
 * files, no database, no admin session). The narrow-screen drawer is mounted above the content so
 * the table of contents stays a single column on a phone.
 */
const DocsLayout = ({ children }: { children: ReactNode }) => (
  // The root layout widens its `main` for this marker, so the docs canvas stays inside the
  // viewport: no viewport-unit breakout means no horizontal scrollbar on a narrow screen.
  <div className="mx-auto w-full max-w-6xl px-6 py-10" data-slot="docs">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:flex-row lg:gap-12">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-24">
          <DocsSidebar docs={docs} />
        </div>
      </aside>
      <div className="lg:hidden">
        <DocsMobileNav docs={docs} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  </div>
);

export default DocsLayout;
