import "server-only";
import { ORPCError } from "@orpc/client";

import {
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_EMAIL,
  SITE_TAGLINE,
  SITE_TITLE,
} from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * The read side of the machine endpoints.
 *
 * Every list procedure pages, so the collectors drain it before a feed, sitemap or index claims to
 * describe the whole site. Pages are read in parallel and deduplicated by id: a concurrent write can
 * shift a boundary between two reads, and the same row must not appear twice.
 */

const PAGE_SIZE = 100;

/** Ten pages is 1000 rows; past that a feed is better split than fetched whole. */
const MAX_PAGES = 10;

export type SitePost = Awaited<
  ReturnType<typeof serverCall.posts.list>
>["items"][number];

export type SiteProfile = Awaited<ReturnType<typeof serverCall.site.profile>>;

export type SiteAlbum = Awaited<
  ReturnType<typeof serverCall.media.albums.list>
>["items"][number];

export type DatedSitePost = SitePost & { publishedAt: Date };

export interface SiteIdentity {
  author: string;
  description: string;
  email: string;
  tagline: string;
  title: string;
}

/**
 * What the shell and the endpoints call the site.
 *
 * The profile row is the source of truth; a fresh database without it still gets a usable name from
 * the same fallbacks the rest of the endpoints use, so no caller has to special-case `null`.
 */
export const describeSite = (profile: SiteProfile | null): SiteIdentity => ({
  author: profile?.author ?? SITE_AUTHOR,
  description: profile?.description ?? SITE_DESCRIPTION,
  email: profile?.email ?? SITE_EMAIL,
  tagline: profile?.tagline ?? SITE_TAGLINE,
  title:
    profile === null
      ? SITE_TITLE
      : profile.name + (profile.nameEn === null ? "" : " " + profile.nameEn),
});

export const loadAllPosts = async (): Promise<SitePost[]> => {
  const first = await serverCall.posts.list({
    direction: "desc",
    orderBy: "publishedAt",
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const pageCount = Math.min(first.totalPages, MAX_PAGES);

  const rest = await Promise.all(
    Array.from(
      { length: Math.max(pageCount - 1, 0) },
      async (_unused, index) =>
        await serverCall.posts.list({
          direction: "desc",
          orderBy: "publishedAt",
          page: index + 2,
          pageSize: PAGE_SIZE,
        })
    )
  );

  const byId = new Map<string, SitePost>();

  for (const page of [first, ...rest]) {
    for (const post of page.items) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()];
};

/** Posts that can carry a timestamp in a feed; an undated post stays on the archive page only. */
export const loadDatedPosts = async (): Promise<DatedSitePost[]> => {
  const posts = await loadAllPosts();

  return posts.filter(
    (post): post is DatedSitePost => post.publishedAt !== null
  );
};

/** The newest timestamp any dated post carries; feeds use it for their build time. */
export const newestStamp = (posts: DatedSitePost[]): Date | null => {
  let newest: Date | null = null;

  for (const post of posts) {
    const stamp = post.updatedAt ?? post.publishedAt;

    if (newest === null || stamp.getTime() > newest.getTime()) {
      newest = stamp;
    }
  }

  return newest;
};

export const loadAlbums = async (): Promise<SiteAlbum[]> => {
  const first = await serverCall.media.albums.list({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const pageCount = Math.min(first.totalPages, MAX_PAGES);

  const rest = await Promise.all(
    Array.from(
      { length: Math.max(pageCount - 1, 0) },
      async (_unused, index) =>
        await serverCall.media.albums.list({
          page: index + 2,
          pageSize: PAGE_SIZE,
        })
    )
  );

  const byId = new Map<string, SiteAlbum>();

  for (const page of [first, ...rest]) {
    for (const album of page.items) {
      byId.set(album.id, album);
    }
  }

  return [...byId.values()];
};

/** A missing profile is a state the site can be in; a broken API is not. */
export const loadSiteProfile = async (): Promise<SiteProfile | null> => {
  try {
    return await serverCall.site.profile();
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
};

/** The article body for an `llms-full` excerpt; a slug deleted mid-read is simply absent. */
export const loadPostBody = async (slug: string): Promise<string | null> => {
  try {
    const post = await serverCall.posts.bySlug({ slug });

    return post.bodyMd;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
};
