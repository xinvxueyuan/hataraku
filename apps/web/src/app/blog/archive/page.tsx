import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@hataraku/ui/components/badge";

import { serverCall } from "#src/server/query.ts";

/**
 * Archive, bucketed by the month a post went out in Asia/Shanghai.
 *
 * The list procedure pages, so this page drains it before grouping: a month bucket is only honest
 * if no page boundary cuts through it. `total` on the response is what the heading reports, so the
 * count and the buckets come from the same read.
 */

export const metadata: Metadata = {
  description: "全部文章按发布月份归档。",
  title: "归档",
};

const PAGE_SIZE = 100;

/** Ten pages is 1000 posts; past that the article list paginates and this page says so. */
const MAX_PAGES = 10;
const SITE_TIME_ZONE = "Asia/Shanghai";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  timeZone: SITE_TIME_ZONE,
});

const partOf = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string => parts.find((part) => part.type === type)?.value ?? "";

type ArchivePost = Awaited<
  ReturnType<typeof serverCall.posts.list>
>["items"][number];

interface MonthGroup {
  key: string;
  label: string;
  posts: ArchivePost[];
}

interface YearGroup {
  label: string;
  months: MonthGroup[];
  postCount: number;
  year: number;
}

const loadArchive = async () => {
  const query = {
    direction: "desc" as const,
    orderBy: "publishedAt" as const,
    pageSize: PAGE_SIZE,
  };

  const first = await serverCall.posts.list({ ...query, page: 1 });
  const pageCount = Math.min(first.totalPages, MAX_PAGES);

  const pageNumbers = Array.from(
    { length: Math.max(pageCount - 1, 0) },
    (_unused, index) => index + 2
  );

  const rest = await Promise.all(
    pageNumbers.map(
      async (page) => await serverCall.posts.list({ ...query, page })
    )
  );

  // A migration can insert between two page reads; a row repeated by a shifted boundary is kept once.
  const byId = new Map<string, ArchivePost>();

  for (const page of [first, ...rest]) {
    for (const post of page.items) {
      byId.set(post.id, post);
    }
  }

  return {
    posts: [...byId.values()],
    total: first.total,
    truncated: first.totalPages > MAX_PAGES,
  };
};

const groupByMonth = (posts: ArchivePost[]) => {
  const years = new Map<number, Map<string, MonthGroup>>();
  const undated: ArchivePost[] = [];

  for (const post of posts) {
    if (post.publishedAt === null) {
      undated.push(post);
      continue;
    }

    const parts = monthFormatter.formatToParts(post.publishedAt);
    const year = Number(partOf(parts, "year"));
    const month = Number(partOf(parts, "month"));
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const months = years.get(year) ?? new Map<string, MonthGroup>();
    const group = months.get(key) ?? { key, label: `${month} 月`, posts: [] };

    group.posts.push(post);
    months.set(key, group);
    years.set(year, months);
  }

  return {
    undated,
    years: [...years.entries()].map(([year, months]): YearGroup => {
      const groups = [...months.values()];

      return {
        label: `${year} 年`,
        months: groups,
        postCount: groups.reduce(
          (total, group) => total + group.posts.length,
          0
        ),
        year,
      };
    }),
  };
};

const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const ArchiveEntry = ({ post }: { post: ArchivePost }) => {
  const day =
    post.publishedAt === null
      ? null
      : Number(partOf(dayFormatter.formatToParts(post.publishedAt), "day"));

  return (
    <article className="flex gap-3">
      <time
        className="text-muted-foreground w-10 shrink-0 pt-1 text-xs tabular-nums"
        dateTime={post.publishedAt?.toISOString()}
      >
        {day === null ? "待定" : `${day} 日`}
      </time>
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="text-base leading-snug font-medium">
          <Link
            className={`${focusRing} hover:underline`}
            href={`/blog/${post.slug}`}
          >
            {post.title}
          </Link>
        </h4>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {post.categorySlug === null ? null : (
            <Badge variant="secondary">{post.categorySlug}</Badge>
          )}
          {post.tags.map((tag) => (
            <Link
              className={`${focusRing} hover:underline`}
              href={`/blog/taxonomy/tag/${tag}`}
              key={tag}
            >
              #{tag}
            </Link>
          ))}
          {post.readingMinutes === null ? null : (
            <span>{post.readingMinutes} 分钟</span>
          )}
        </div>
      </div>
    </article>
  );
};

const ArchivePage = async () => {
  const { posts, total, truncated } = await loadArchive();
  const { undated, years } = groupByMonth(posts);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">归档</h1>
        <p className="text-muted-foreground">
          {total} 篇文章，按发布月份排列（{SITE_TIME_ZONE}）。
          {truncated
            ? ` 这里只列出最近 ${MAX_PAGES * PAGE_SIZE} 篇，更早的文章请到写作页继续翻页。`
            : null}
        </p>
      </header>

      {total === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          还没有可归档的文章。发布第一篇后，它会按月份出现在这里——先去{" "}
          <Link className={`${focusRing} underline`} href="/blog">
            写作
          </Link>{" "}
          看看，或者回到{" "}
          <Link className={`${focusRing} underline`} href="/">
            首页
          </Link>
          。
        </p>
      ) : (
        <>
          {years.length === 0 ? null : (
            <nav
              aria-label="按年份跳转"
              className="flex flex-wrap gap-2 text-sm"
            >
              {years.map((year) => (
                <a
                  className="hover:bg-accent focus-visible:ring-ring focus-visible:ring-offset-background inline-flex items-center gap-2 rounded-full border px-3 py-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  href={`#year-${year.year}`}
                  key={year.year}
                >
                  {year.label}
                  <span className="text-muted-foreground text-xs">
                    {year.postCount} 篇
                  </span>
                </a>
              ))}
            </nav>
          )}

          {years.map((year) => (
            <section
              aria-labelledby={`year-${year.year}-heading`}
              className="flex scroll-mt-20 flex-col gap-6"
              id={`year-${year.year}`}
              key={year.year}
            >
              <h2
                className="text-2xl font-semibold tracking-tight"
                id={`year-${year.year}-heading`}
              >
                {year.label}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {year.postCount} 篇
                </span>
              </h2>
              {year.months.map((month) => (
                <section
                  aria-labelledby={`month-${month.key}-heading`}
                  className="flex flex-col gap-2"
                  id={`month-${month.key}`}
                  key={month.key}
                >
                  <h3
                    className="text-muted-foreground text-sm font-medium tracking-wide"
                    id={`month-${month.key}-heading`}
                  >
                    {month.label}
                  </h3>
                  <ul className="divide-border flex flex-col divide-y">
                    {month.posts.map((post) => (
                      <li className="py-3" key={post.id}>
                        <ArchiveEntry post={post} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          ))}

          {undated.length === 0 ? null : (
            <section
              aria-labelledby="undated-heading"
              className="flex flex-col gap-2"
            >
              <h2
                className="text-2xl font-semibold tracking-tight"
                id="undated-heading"
              >
                日期待定
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {undated.length} 篇
                </span>
              </h2>
              <p className="text-muted-foreground text-sm">
                这些文章还没有发布时间，补上之后会排进对应月份。
              </p>
              <ul className="divide-border flex flex-col divide-y">
                {undated.map((post) => (
                  <li className="py-3" key={post.id}>
                    <ArchiveEntry post={post} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <footer className="text-muted-foreground border-t pt-4 text-sm">
        换个角度看：按{" "}
        <Link className={`${focusRing} underline`} href="/blog/taxonomy">
          分类与标签
        </Link>{" "}
        浏览，或者去{" "}
        <Link className={`${focusRing} underline`} href="/albums">
          相册
        </Link>
        。
      </footer>
    </div>
  );
};

export default ArchivePage;
