import "server-only";
import { ORPCError } from "@orpc/client";
import { cache } from "react";

import type { AnalyticsSettings } from "#src/components/site-analytics-settings.ts";
import {
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_EMAIL,
  SITE_NAME,
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
  /** The short name, as the header and the copyright line use it. */
  name: string;
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
  name: profile?.name ?? SITE_NAME,
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

  const byId = new Map<number, SitePost>();

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

  const byId = new Map<number, SiteAlbum>();

  for (const page of [first, ...rest]) {
    for (const album of page.items) {
      byId.set(album.id, album);
    }
  }

  return [...byId.values()];
};

/**
 * A missing profile is a state the site can be in; a broken API is not.
 *
 * Cached for the request: the shell reads it for the identity, the metadata and the analytics tag,
 * and all three must agree on one row.
 */
export const loadSiteProfile = cache(async (): Promise<SiteProfile | null> => {
  try {
    return await serverCall.site.profile();
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
});

/**
 * The analytics settings, or `null` when there is nothing to inject.
 *
 * The read is tolerant on purpose: a production build prerenders pages that never carry this tag
 * (`/_not-found` among them) without a database in the environment, and a build must not fail over
 * a setting that only matters at request time. A page whose data cannot be read fails loudly
 * elsewhere — the tag is not where that gets reported.
 */
export const loadAnalyticsSettings =
  async (): Promise<AnalyticsSettings | null> => {
    try {
      const profile = await loadSiteProfile();

      return profile === null ? null : profile.analytics;
    } catch {
      return null;
    }
  };

/**
 * The identity the shell renders, cached for the request so the header and the footer share one
 * read; a profile changed in the editor shows up on the next request, not on a rebuilt constant.
 */
export const loadSiteIdentity = cache(async (): Promise<SiteIdentity> =>
  describeSite(await loadSiteProfile())
);

/** The article body for an `llms-full` excerpt; a segment deleted mid-read is simply absent. */
export const loadPostBody = async (segment: string): Promise<string | null> => {
  try {
    const post = await serverCall.posts.byRef({ segment });

    return post.bodyMd;
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      return null;
    }

    throw error;
  }
};
