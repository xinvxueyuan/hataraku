import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@hataraku/ui/components/badge";

import { serverCall } from "#src/server/query.ts";

/**
 * Taxonomy index: every category and every tag with the number of published posts behind it.
 *
 * `overview` counts posts with the same visibility rule the post list applies, so a count here
 * is the number of articles the detail page will show.
 */

export const metadata: Metadata = {
  description: "按分类与标签浏览全部文章。",
  title: "分类与标签",
};

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const TaxonomyPage = async () => {
  const { categories, tags, totalPosts } = await serverCall.taxonomy.overview();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">分类与标签</h1>
        <p className="text-muted-foreground">
          {totalPosts} 篇文章，分在 {categories.length} 个分类、{tags.length}{" "}
          个标签里。
        </p>
      </header>

      <section
        aria-labelledby="categories-heading"
        className="flex flex-col gap-4"
      >
        <h2 className="text-xl font-semibold" id="categories-heading">
          分类
        </h2>
        {categories.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有分类。给文章分好类之后，这里会按顺序列出它们——先去{" "}
            <Link className={`${focusRing} underline`} href="/article">
              文章列表
            </Link>{" "}
            看看现在的文章。
          </p>
        ) : (
          <ul
            className="grid gap-3 sm:grid-cols-2"
            data-slot="taxonomy-categories"
          >
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  className={`${focusRing} hover:bg-accent flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors`}
                  href={`/taxonomy/category/${category.slug}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {category.postCount} 篇
                    </span>
                  </span>
                  {category.description === null ? null : (
                    <span className="text-muted-foreground text-sm">
                      {category.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tags-heading" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold" id="tags-heading">
          标签
        </h2>
        <p className="text-muted-foreground text-sm">
          按文章数量排序，数字是这个标签下的文章数。
        </p>
        {tags.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有标签。给文章打上标签后，它们会在这里聚成一团——从{" "}
            <Link className={`${focusRing} underline`} href="/archive">
              归档
            </Link>{" "}
            里挑一篇文章开始。
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-slot="taxonomy-tags">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  className={`${focusRing} hover:bg-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors`}
                  href={`/taxonomy/tag/${tag.slug}`}
                >
                  <span>{tag.name}</span>
                  <Badge variant="secondary">{tag.postCount}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="text-muted-foreground border-t pt-4 text-sm">
        也可以按时间浏览：
        <Link className={`${focusRing} ml-1 underline`} href="/archive">
          归档
        </Link>
        ，或者去{" "}
        <Link className={`${focusRing} underline`} href="/article">
          文章列表
        </Link>
        。
      </footer>
    </div>
  );
};

export default TaxonomyPage;
