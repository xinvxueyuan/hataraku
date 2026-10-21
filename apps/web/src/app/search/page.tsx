import type { Metadata } from "next";
import Link from "next/link";

import { serverCall } from "#src/server/query.ts";

/**
 * Search. Ranking, prefix matching and the Chinese tokenizer live in the procedure (the in-process
 * Orama index), so this page only renders what came back — filtering again here would fight it.
 */

export const metadata: Metadata = { title: "搜索" };

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const SearchPage = async ({ searchParams }: PageProps) => {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const result =
    query.length === 0
      ? null
      : await serverCall.search.query({ page: 1, pageSize: 20, q: query });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">搜索</h1>
        <search className="flex gap-2">
          <form action="/search" className="flex w-full gap-2" method="get">
            <label className="sr-only" htmlFor="search-input">
              搜索关键词
            </label>
            <input
              className="bg-background flex-1 rounded-md border px-3 py-2 text-sm"
              defaultValue={query}
              id="search-input"
              name="q"
              placeholder="输入关键词"
              type="search"
            />
            <button
              className="hover:bg-accent rounded-md border px-3 py-2 text-sm"
              type="submit"
            >
              搜索
            </button>
          </form>
        </search>
      </header>

      {result === null ? (
        <p className="text-muted-foreground">输入关键词开始搜索。</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            找到 {result.total} 条结果
          </p>

          {result.items.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6">
              没有匹配的文章。试一个更短的词。
            </p>
          ) : (
            <ul className="flex flex-col gap-4" data-slot="search-results">
              {result.items.map((hit) => (
                <li key={hit.slug}>
                  <Link
                    className="text-lg font-medium hover:underline"
                    href={`/posts/${hit.slug}`}
                  >
                    {hit.title}
                  </Link>
                  {hit.description === null ? null : (
                    <p className="text-muted-foreground text-sm">
                      {hit.description}
                    </p>
                  )}
                  {hit.publishedAt === null ? null : (
                    <time
                      className="text-muted-foreground text-xs"
                      dateTime={hit.publishedAt.toISOString()}
                    >
                      {dateFormatter.format(hit.publishedAt)}
                    </time>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
};

export default SearchPage;
