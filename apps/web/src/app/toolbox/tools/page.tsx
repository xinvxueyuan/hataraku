import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Pager } from "@hataraku/components/pager";
import { Badge } from "@hataraku/ui/components/badge";

import { ToolboxSection } from "#src/components/toolbox-section.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The tools shelf, paginated because a tool list grows without a natural end.
 *
 * An empty shelf is a real state, not a rendering accident: the section says what it would hold and
 * where to go instead of disappearing from the hub.
 */

export const metadata: Metadata = {
  description: "日常使用的软件、终端与编辑器。",
  title: "工具",
};

const PAGE_SIZE = 12;

const CATEGORY_LABELS = new Map([
  ["design", "设计"],
  ["devtools", "开发工具"],
  ["editor", "编辑器"],
  ["terminal", "终端"],
]);

type Tool = Awaited<
  ReturnType<typeof serverCall.content.tools.list>
>["items"][number];

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const hrefFor = (page: number): string =>
  page <= 1 ? "/toolbox/tools" : `/toolbox/tools?page=${page}`;

const ToolCard = ({ tool }: { tool: Tool }) => (
  <article className="flex h-full flex-col gap-2 rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="font-medium">{tool.name}</h2>
      <Badge variant="outline">
        {CATEGORY_LABELS.get(tool.category) ?? tool.category}
      </Badge>
    </div>
    {tool.description === null ? null : (
      <p className="text-muted-foreground text-sm">{tool.description}</p>
    )}
    <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
      {tool.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1">
          {tool.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      {tool.link === null ? null : (
        <a
          className={`${focusRing} text-sm underline underline-offset-4`}
          href={tool.link}
          rel="noopener noreferrer"
          target="_blank"
        >
          打开
        </a>
      )}
    </div>
  </article>
);

const ToolsPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const tools = await serverCall.content.tools.list({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <ToolboxSection
      count={`共 ${tools.total} 个工具`}
      description="日常在用的软件、终端与编辑器，按用途分组。"
      empty={
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          还没有收录工具。把常用的软件与命令整理进来后，它们会出现在这里——先去{" "}
          <Link className={`${focusRing} underline`} href="/projects">
            项目
          </Link>{" "}
          看看现在在做什么。
        </p>
      }
      footer={
        <Pager
          currentPage={tools.page}
          hrefFor={hrefFor}
          label="工具分页"
          totalPages={tools.totalPages}
        />
      }
      hasItems={tools.items.length > 0}
      title="工具"
    >
      <ul className="grid gap-4 sm:grid-cols-2" data-slot="tool-list">
        {tools.items.map((tool) => (
          <li key={tool.id}>
            <ToolCard tool={tool} />
          </li>
        ))}
      </ul>
    </ToolboxSection>
  );
};

export default ToolsPage;
