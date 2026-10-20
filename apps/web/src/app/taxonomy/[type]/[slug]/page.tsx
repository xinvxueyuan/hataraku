import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge } from "@hataraku/ui/components/badge";

import { Pager } from "#src/components/pager.tsx";
import { PostCover } from "#src/components/post-cover.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * One category or tag and the articles filed under it.
 *
 * The two kinds differ only in which taxonomy read finds the entry and which filter the post list
 * takes, so they share a loader: `cache` keeps `generateMetadata` and the page from reading twice
 * in one request.
 */

const PAGE_SIZE = 20;

const KINDS = {
  category: { label: "分类" },
  tag: { label: "标签" },
} as const;

type TaxonomyKind = keyof typeof KINDS;

const isKind = (value: string): value is TaxonomyKind =>
  Object.hasOwn(KINDS, value);

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

/** A non-ASCII segment arrives percent-encoded; the stored slug is the decoded form. */
const readSlug = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

type PostPage = Awaited<ReturnType<typeof serverCall.posts.list>>;

interface TaxonomyDetail {
  description: string | null;
  kind: TaxonomyKind;
  name: string;
  posts: PostPage;
  slug: string;
}

const loadDetail = cache(
  async (
    kind: TaxonomyKind,
    slug: string,
    page: number
  ): Promise<TaxonomyDetail | null> => {
    if (kind === "category") {
      const categories = await serverCall.taxonomy.categories();
      const category = categories.find((item) => item.slug === slug);

      if (category === undefined) {
        return null;
      }

      const posts = await serverCall.posts.list({
        categorySlug: slug,
        direction: "desc",
        orderBy: "publishedAt",
        page,
        pageSize: PAGE_SIZE,
      });

      return {
        description: category.description,
        kind,
        name: category.name,
        posts,
        slug,
      };
    }

    // minCount 0: an index that lists a tag must be able to open it, even when every post under
    // it is still a draft (the page then says so instead of 404ing on a link the index printed).
    const tags = await serverCall.taxonomy.tags({
      minCount: 0,
      orderBy: "name",
    });

    const tag = tags.find((item) => item.slug === slug);

    if (tag === undefined) {
      return null;
    }

    const posts = await serverCall.posts.list({
      direction: "desc",
      orderBy: "publishedAt",
      page,
      pageSize: PAGE_SIZE,
      tagSlugs: [slug],
    });

    return {
      description: tag.description,
      kind,
      name: tag.name,
      posts,
      slug,
    };
  }
);

interface PageProps {
  params: Promise<{ slug: string; type: string }>;
  searchParams: Promise<{ page?: string }>;
}

const hrefFor = (kind: TaxonomyKind, slug: string, page: number): string =>
  page <= 1
    ? `/taxonomy/${kind}/${slug}`
    : `/taxonomy/${kind}/${slug}?page=${page}`;

const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { type, slug: rawSlug } = await params;
  const slug = readSlug(rawSlug);

  if (!isKind(type)) {
    return { title: "未找到" };
  }

  const detail = await loadDetail(type, slug, 1);

  if (detail === null) {
    return { title: "未找到" };
  }

  return {
    description:
      detail.description ??
      `${KINDS[type].label}「${detail.name}」下的全部文章。`,
    title: `${KINDS[type].label}：${detail.name}`,
  };
};

const TaxonomyDetailPage = async ({ params, searchParams }: PageProps) => {
  const [{ type, slug: rawSlug }, { page: rawPage }] = await Promise.all([
    params,
    searchParams,
  ]);

  const slug = readSlug(rawSlug);
  const page = readPage(rawPage);

  if (!isKind(type)) {
    notFound();
  }

  const detail = await loadDetail(type, slug, page);

  if (detail === null) {
    notFound();
  }

  const { label } = KINDS[detail.kind];
  const { posts } = detail;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          className={`${focusRing} text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline`}
          href="/taxonomy"
        >
          ← 全部{label}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {label}：{detail.name}
        </h1>
        {detail.description === null ? null : (
          <p className="text-muted-foreground">{detail.description}</p>
        )}
        <p className="text-muted-foreground text-sm">
          共 {posts.total} 篇文章
          {posts.totalPages > 1 && posts.page <= posts.totalPages
            ? `，第 ${posts.page} / ${posts.totalPages} 页`
            : null}
        </p>
      </header>

      {posts.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          {posts.total === 0
            ? `这个${label}下还没有文章。等有文章归入${label}「${detail.name}」后，它们会出现在这里——先去归档挑一篇读读。`
            : "这一页没有文章了。"}
          {page > 1 ? (
            <>
              {" "}
              <a
                className={`${focusRing} underline`}
                href={hrefFor(detail.kind, detail.slug, 1)}
              >
                回到第一页
              </a>
              。
            </>
          ) : (
            <>
              {" "}
              <Link className={`${focusRing} underline`} href="/archive">
                去归档看看
              </Link>
              。
            </>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-5" data-slot="taxonomy-posts">
          {posts.items.map((post) => (
            <li key={post.id}>
              <article className="flex gap-4">
                <PostCover
                  className="w-28 shrink-0 sm:w-40"
                  coverKey={post.coverKey}
                  coverSrc={post.cover?.src ?? null}
                  sizes="(min-width: 640px) 160px, 112px"
                  title={post.title}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-lg leading-snug font-medium">
                    <Link
                      className={`${focusRing} hover:underline`}
                      href={`/posts/${post.slug}`}
                    >
                      {post.title}
                    </Link>
                  </h2>
                  {post.description === null ? null : (
                    <p className="text-muted-foreground text-sm">
                      {post.description}
                    </p>
                  )}
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {post.publishedAt === null ? null : (
                      <time dateTime={post.publishedAt.toISOString()}>
                        {dateFormatter.format(post.publishedAt)}
                      </time>
                    )}
                    {post.categorySlug === null ? null : (
                      <Badge variant="secondary">{post.categorySlug}</Badge>
                    )}
                    {post.tags.map((tag) => (
                      <Link
                        className={`${focusRing} hover:underline`}
                        href={`/taxonomy/tag/${tag}`}
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
            </li>
          ))}
        </ul>
      )}

      <Pager
        currentPage={posts.page}
        hrefFor={(target) => hrefFor(detail.kind, detail.slug, target)}
        label={`${label}「${detail.name}」分页`}
        totalPages={posts.totalPages}
      />
    </div>
  );
};

export default TaxonomyDetailPage;
