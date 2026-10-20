import type { Metadata } from "next";
import Link from "next/link";

import { serverCall } from "#src/server/query.ts";

/**
 * Home page: the newest articles, the taxonomy at a glance, and the site's own description.
 *
 * Everything is read on the server and rendered once. Nothing here hydrates, so the procedures are
 * called directly instead of going through the query cache.
 */

export const metadata: Metadata = {
  description: "夜行栈：文章、项目与随手记录。",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

/**
 * Reads the site profile, treating "not configured yet" as absent.
 *
 * A fresh database has no profile row and the procedure answers NOT_FOUND. The home page is the
 * route the end-to-end stack polls for health, so turning that into a 500 would make an unconfigured
 * site look broken and would stop the suite before its first assertion. The page renders without the
 * profile instead.
 */
const readProfile = async () => {
  try {
    return await serverCall.site.profile();
  } catch {
    return null;
  }
};

const HomePage = async () => {
  const [latest, taxonomy, profile] = await Promise.all([
    serverCall.posts.list({ page: 1, pageSize: 6 }),
    serverCall.taxonomy.overview(),
    readProfile(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          {profile?.name ?? "夜行栈"}
        </h1>
        {profile?.tagline == null ? null : (
          <p className="text-muted-foreground text-lg">{profile.tagline}</p>
        )}
        {profile?.description == null ? null : (
          <p className="text-muted-foreground max-w-2xl">
            {profile.description}
          </p>
        )}
      </header>

      <section aria-labelledby="latest-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold" id="latest-heading">
            最新文章
          </h2>
          <Link
            className="text-muted-foreground text-sm hover:underline"
            href="/article"
          >
            全部文章
          </Link>
        </div>

        {latest.items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6">
            还没有发布文章。写好第一篇之后，它会出现在这里。
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-slot="latest-list">
            {latest.items.map((post) => (
              <li key={post.id}>
                <Link
                  className="hover:bg-accent flex flex-col gap-1 rounded-lg border p-4 transition-colors"
                  href={`/posts/${post.slug}`}
                >
                  <span className="font-medium">{post.title}</span>
                  {post.description === null ? null : (
                    <span className="text-muted-foreground text-sm">
                      {post.description}
                    </span>
                  )}
                  {post.publishedAt === null ? null : (
                    <time
                      className="text-muted-foreground text-xs"
                      dateTime={post.publishedAt.toISOString()}
                    >
                      {dateFormatter.format(post.publishedAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="taxonomy-heading"
        className="flex flex-col gap-3"
      >
        <h2 className="text-xl font-semibold" id="taxonomy-heading">
          分类
        </h2>
        {taxonomy.categories.length === 0 ? (
          <p className="text-muted-foreground">还没有分类。</p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-slot="category-list">
            {taxonomy.categories.map((category) => (
              <li key={category.id}>
                <Link
                  className="hover:bg-accent inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                  href={`/article?category=${category.slug}`}
                >
                  {category.name}
                  <span className="text-muted-foreground text-xs">
                    {category.postCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
};

export default HomePage;
