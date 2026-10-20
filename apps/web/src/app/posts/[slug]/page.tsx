import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostCover } from "#src/components/post-cover.tsx";
import { absoluteUrl, dateOnly, siteOrigin } from "#src/components/site.ts";
import { renderMdx } from "#src/server/mdx.ts";
import { getQueryClient, serverApi } from "#src/server/query.ts";

/**
 * Article page. The body is MDX stored in Postgres and rendered on the server by `renderMdx`,
 * which owns the sandbox that keeps a body from evaluating code.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Reads the post through the API server and turns a missing or unpublished slug into a 404.
 *
 * The procedure is public, so its only failure for a detail read is NOT_FOUND; anything else is a
 * real fault and is left to Next to report rather than being flattened into a 404.
 */
const loadPost = async (slug: string) => {
  const queryClient = getQueryClient();
  const options = serverApi.posts.bySlug.queryOptions({ input: { slug } });

  await queryClient.query(options).catch(() => {
    notFound();
  });

  const post = queryClient.getQueryData(options.queryKey);

  if (post === undefined) {
    notFound();
  }

  return post;
};

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { slug } = await params;
  const post = await loadPost(slug);
  const origin = await siteOrigin();

  const published =
    post.publishedAt === null ? "" : (dateOnly(post.publishedAt) ?? "");

  const card = new URLSearchParams({ title: post.title });

  if (post.description !== null) {
    card.set("description", post.description);
  }

  if (post.category !== null) {
    card.set("category", post.category.name);
  }

  if (published !== "") {
    card.set("date", published);
  }

  const image = absoluteUrl(origin, `/api/og?${card.toString()}`);

  return {
    description: post.description ?? undefined,
    openGraph: {
      description: post.description ?? undefined,
      images: [
        {
          alt: `${post.title} 的分享图`,
          height: 630,
          url: image,
          width: 1200,
        },
      ],
      title: post.title,
      type: "article",
      url: `/posts/${post.slug}`,
    },
    title: post.title,
  };
};

const PostPage = async ({ params }: PageProps) => {
  const { slug } = await params;
  const post = await loadPost(slug);
  const body = post.bodyMd === null ? null : await renderMdx(post.bodyMd);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <PostCover
        aspectClassName="aspect-[2/1]"
        coverKey={post.coverKey}
        coverSrc={post.cover?.src ?? null}
        sizes="(min-width: 768px) 768px, 100vw"
        title={post.title}
      />

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        {post.description === null ? null : (
          <p className="text-muted-foreground">{post.description}</p>
        )}
      </header>

      {body === null ? (
        <p className="text-muted-foreground">这篇文章还没有正文。</p>
      ) : (
        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          data-slot="post-body"
        >
          {body}
        </div>
      )}
    </article>
  );
};

export default PostPage;
