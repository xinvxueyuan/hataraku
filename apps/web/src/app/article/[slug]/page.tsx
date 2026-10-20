import { ORPCError } from "@orpc/client";
import { permanentRedirect, redirect } from "next/navigation";

import { serverCall } from "#src/server/query.ts";

/**
 * The v2 article URL, kept alive as an alias.
 *
 * v2 published every article at /article/<slug>; v3 publishes at /posts/<slug> and uses /article for
 * the list. External links, feed readers and search results still point at the old shape.
 *
 * A next.config redirect cannot do this job: it is evaluated before routing, so it cannot ask
 * whether the slug names a published post, and a slug that is gone has to land on the list instead
 * of a dead end. The decision therefore lives in the one segment that knows the answer:
 *
 * - a published post answers 308 (permanentRedirect) to its canonical URL;
 * - anything else answers 307 (redirect) to the list, because an unpublished slug may become
 *   public later and a permanently cached "go to the list" would outlive that change.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Next may hand a non-ASCII slug through percent-encoded; v2's detail page carried the same guard. */
const decodeSlug = (raw: string) => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const findPost = async (slug: string) => {
  try {
    return await serverCall.posts.bySlug({ slug });
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
};

type FoundPost = NonNullable<Awaited<ReturnType<typeof findPost>>>;

const LegacyArticlePage = async ({ params }: PageProps) => {
  const { slug } = await params;

  // Both spellings are looked up at once: Next may hand the segment through percent-encoded, and a
  // sequential retry would double the latency of every legacy request.
  const candidates = [...new Set([slug, decodeSlug(slug)])];
  const results = await Promise.all(candidates.map(findPost));
  const found = results.find((post): post is FoundPost => post !== null);

  if (found === undefined) {
    redirect("/article");
  }

  permanentRedirect(`/posts/${encodeURIComponent(found.slug)}`);
};

export default LegacyArticlePage;
