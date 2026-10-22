import type { Metadata } from "next";
import Link from "next/link";

import { highlightMatches } from "@hataraku/components/highlight";

import { contentPath } from "#src/components/content-path.ts";
import { SearchForm } from "#src/components/search-form.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * Search. Ranking, prefix matching and the Chinese tokenizer live in the procedure (the in-process
 * Orama index), so this page only renders what came back — filtering again here would fight it.
 *
 * The field is a client component because it debounces input; the results stay on the server so a
 * shared `/search?q=…` link is rendered with its matches before hydration.
 */

export const metadata: Metadata = { title: "搜索" };

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

/** Empty-result advice: say what happened and what to try next, not "no data". */
const EmptyResult = ({ query }: { query: string }) => {
  if (query.length <= 1) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
        <p className="text-muted-foreground">
          「{query}」只有一个字，命中的范围太宽，暂时没有可展示的文章。
        </p>
        <p className="text-sm">
          换一个更具体的词试试，或者{" "}
          <Link className="underline underline-offset-4" href="/blog">
            去看全部文章
          </Link>
          。
        </p>
      </div>
    );
  }

  if (query.length > 24) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
        <p className="text-muted-foreground">
          这个关键词有点长（{query.length} 个字），很少会整段出现在文章里。
        </p>
        <p className="text-sm">
          试试更短的词，或者{" "}
          <Link className="underline underline-offset-4" href="/blog">
            去看全部文章
          </Link>
          。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-6">
      <p className="text-muted-foreground">
        没有找到与「{query}」匹配的文章。它可能还没被写过，或者用了别的说法。
      </p>
      <p className="text-sm">
        试试更短的词，或者{" "}
        <Link className="underline underline-offset-4" href="/blog">
          去看全部文章
        </Link>
        。
      </p>
    </div>
  );
};

const SearchPage = async ({ searchParams }: PageProps) => {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const result =
    query.length === 0
      ? null
      : await serverCall.search.query({ page: 1, pageSize: 20, q: query });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">搜索</h1>
        <SearchForm query={query} />
      </header>

      {result === null ? (
        <p className="text-muted-foreground">输入关键词开始搜索。</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm" data-slot="search-count">
            找到 {result.total} 条结果
          </p>

          {result.items.length === 0 ? (
            <EmptyResult query={query} />
          ) : (
            <ul className="flex flex-col gap-4" data-slot="search-results">
              {result.items.map((hit) => (
                <li key={hit.slug}>
                  <Link
                    className="text-lg font-medium hover:underline"
                    href={contentPath("/blog", {
                      id: hit.id,
                      slug: hit.slug,
                      slugOnly: hit.slugOnly,
                    })}
                  >
                    {highlightMatches(hit.title, query)}
                  </Link>
                  {hit.description === null ? null : (
                    <p className="text-muted-foreground text-sm">
                      {highlightMatches(hit.description, query)}
                    </p>
                  )}
                  {hit.snippet === null ? null : (
                    <p
                      className="text-muted-foreground text-sm"
                      data-slot="search-snippet"
                    >
                      {highlightMatches(
                        hit.snippet.text,
                        query,
                        hit.snippet.matches
                      )}
                    </p>
                  )}
                  <div
                    className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                    data-slot="search-meta"
                  >
                    {hit.categorySlug === null ? null : (
                      <Link
                        className="shrink-0 hover:underline"
                        href={`/blog?category=${encodeURIComponent(hit.categorySlug)}`}
                      >
                        分类：{hit.categorySlug}
                      </Link>
                    )}
                    {hit.publishedAt === null ? null : (
                      <time
                        className="shrink-0"
                        dateTime={hit.publishedAt.toISOString()}
                      >
                        {dateFormatter.format(hit.publishedAt)}
                      </time>
                    )}
                    {hit.readingMinutes === null ? null : (
                      <span className="shrink-0">
                        {hit.readingMinutes} 分钟阅读
                      </span>
                    )}
                    {hit.tags.slice(0, 3).map((tag) => (
                      <Link
                        className="shrink-0 hover:underline"
                        href={`/blog?tag=${encodeURIComponent(tag)}`}
                        key={tag}
                      >
                        #{tag}
                      </Link>
                    ))}
                    {hit.tags.length > 4 ? (
                      <span className="shrink-0">+{hit.tags.length - 3}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;
