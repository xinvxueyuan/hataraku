import type { Metadata } from "next";
import Link from "next/link";

import { serverCall } from "#src/server/query.ts";

/**
 * Article list with filtering and pagination.
 *
 * The filter lives in the URL so a filtered list is linkable, and the procedure does the filtering
 * rather than the page: `total` and `totalPages` come back from the same query, so the pager cannot
 * disagree with the rows above it.
 */

export const metadata: Metadata = {
  description: "按时间排列的全部文章。",
  title: "文章",
};

const PAGE_SIZE = 10;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

interface PageProps {
  searchParams: Promise<{
    category?: string;
    page?: string;
    tag?: string;
  }>;
}

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

/** A link that stays inside this route; `next/link` is typed against the route's own shape. */
type ArticleListHref = `/article${string}`;

/** Builds a list URL that keeps the active filters. */
const listHref = (params: {
  category?: string;
  page?: number;
  tag?: string;
}): ArticleListHref => {
  const search = new URLSearchParams();

  if (params.category !== undefined) {
    search.set("category", params.category);
  }

  if (params.tag !== undefined) {
    search.set("tag", params.tag);
  }

  if (params.page !== undefined) {
    search.set("page", String(params.page));
  }

  const query = search.toString();

  return query.length === 0 ? "/article" : `/article?${query}`;
};

const ArticlePage = async ({ searchParams }: PageProps) => {
  const { category, page: rawPage, tag } = await searchParams;
  const page = readPage(rawPage);

  const result = await serverCall.posts.list({
    categorySlug: category,
    direction: "desc",
    orderBy: "publishedAt",
    page,
    pageSize: PAGE_SIZE,
    tagSlugs: tag === undefined ? undefined : [tag],
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">文章</h1>
        <p className="text-muted-foreground">
          共 {result.total} 篇
          {category === undefined ? null : `，分类：${category}`}
          {tag === undefined ? null : `，标签：${tag}`}
        </p>
        {category === undefined && tag === undefined ? null : (
          <Link className="text-sm hover:underline" href="/article">
            清除筛选
          </Link>
        )}
      </header>

      {result.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          这个条件下没有文章。换一个筛选，或者回到全部文章看看。
        </p>
      ) : (
        <ul className="flex flex-col gap-4" data-slot="article-list">
          {result.items.map((post) => (
            <li key={post.id}>
              <article className="flex flex-col gap-1">
                <Link
                  className="text-lg font-medium hover:underline"
                  href={`/posts/${post.slug}`}
                >
                  {post.title}
                </Link>
                {post.description === null ? null : (
                  <p className="text-muted-foreground text-sm">
                    {post.description}
                  </p>
                )}
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                  {post.publishedAt === null ? null : (
                    <time dateTime={post.publishedAt.toISOString()}>
                      {dateFormatter.format(post.publishedAt)}
                    </time>
                  )}
                  {post.tags.map((slug) => (
                    <a
                      className="hover:underline"
                      href={listHref({ tag: slug })}
                      key={slug}
                    >
                      #{slug}
                    </a>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav
          aria-label="分页"
          className="flex items-center justify-between border-t pt-4 text-sm"
        >
          {page <= 1 ? (
            <span className="text-muted-foreground">上一页</span>
          ) : (
            <a
              className="hover:underline"
              href={listHref({ category, page: page - 1, tag })}
            >
              上一页
            </a>
          )}
          <span className="text-muted-foreground">
            第 {result.page} / {result.totalPages} 页
          </span>
          {page >= result.totalPages ? (
            <span className="text-muted-foreground">下一页</span>
          ) : (
            <a
              className="hover:underline"
              href={listHref({ category, page: page + 1, tag })}
            >
              下一页
            </a>
          )}
        </nav>
      ) : null}
    </main>
  );
};

export default ArticlePage;
