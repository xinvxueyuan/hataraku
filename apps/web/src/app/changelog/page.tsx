import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@hataraku/ui/components/badge";

import { formatDisplayDate } from "#src/components/display-date.ts";
import { focusRing } from "#src/components/focus-ring.ts";
import { Pager } from "#src/components/pager.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The changelog, newest release first.
 *
 * `changes` is the structured list the site writes into each entry; older entries only carry a
 * markdown body. Both are rendered, and the body is shown as running text because the changelog
 * does not go through the article MDX pipeline.
 */

export const metadata: Metadata = {
  description: "站点的版本迭代记录与变更清单。",
  title: "更新日志",
};

const PAGE_SIZE = 10;

type ChangelogEntry = Awaited<
  ReturnType<typeof serverCall.content.changelog.list>
>["items"][number];

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const hrefFor = (page: number): string =>
  page <= 1 ? "/changelog" : `/changelog?page=${page}`;

const ChangelogItem = ({ entry }: { entry: ChangelogEntry }) => {
  const date = formatDisplayDate(entry.releasedAt ?? entry.createdAt);
  let body: ReactNode = null;

  if (entry.changes.length > 0) {
    body = (
      <ul className="marker:text-muted-foreground text-muted-foreground list-disc space-y-1 pl-5 text-sm">
        {entry.changes.map((change) => (
          <li key={change}>{change}</li>
        ))}
      </ul>
    );
  } else if (entry.bodyMd !== null) {
    body = (
      <p className="text-muted-foreground text-sm whitespace-pre-line">
        {entry.bodyMd}
      </p>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border p-5">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {entry.version}
        </h2>
        {entry.highlight ? <Badge>重点版本</Badge> : null}
        {date === null ? null : (
          <time
            className="text-muted-foreground text-xs"
            dateTime={entry.releasedAt ?? entry.createdAt.toISOString()}
          >
            {date}
          </time>
        )}
      </header>

      {entry.title === null ? null : (
        <p className="font-medium">{entry.title}</p>
      )}

      {body}
    </article>
  );
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const ChangelogPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const result = await serverCall.content.changelog.list({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">更新日志</h1>
        <p className="text-muted-foreground">
          共 {result.total} 次版本记录，按发布时间从新到旧排列。
        </p>
      </header>

      {result.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          {result.total === 0 ? (
            <>
              还没有更新记录。第一次版本发布后，会按时间出现在这里——先去{" "}
              <Link className={`${focusRing} underline`} href="/projects">
                项目
              </Link>{" "}
              看看在做什么，或者回到{" "}
              <Link className={`${focusRing} underline`} href="/">
                首页
              </Link>
              。
            </>
          ) : (
            <>
              这一页没有记录。{" "}
              <Link className={`${focusRing} underline`} href="/changelog">
                回到第一页
              </Link>
              。
            </>
          )}
        </p>
      ) : (
        <ol className="flex flex-col gap-4" data-slot="changelog-list">
          {result.items.map((entry) => (
            <li key={entry.id}>
              <ChangelogItem entry={entry} />
            </li>
          ))}
        </ol>
      )}

      <Pager
        currentPage={result.page}
        hrefFor={hrefFor}
        label="更新日志分页"
        totalPages={result.totalPages}
      />
    </div>
  );
};

export default ChangelogPage;
