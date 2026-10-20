import type { MetadataRoute } from "next";

import {
  loadAlbums,
  loadAllPosts,
  loadSiteProfile,
} from "#src/components/site-content.ts";
import { absoluteUrl, siteOrigin } from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * Every URL a crawler should know: the fixed pages, every published article, both taxonomy kinds
 * and each album.
 *
 * `force-dynamic` is deliberate. The default would render this once at build time, and a build does
 * not have the API server — the sitemap would either fail the build or freeze whatever existed when
 * it ran. Rendering per request keeps it in step with the database, and the response is small.
 */

export const dynamic = "force-dynamic";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

interface StaticPage {
  changeFrequency: ChangeFrequency;
  path: string;
  priority: number;
}

/** Login, todos, settings and search are utility routes, not indexable content. */
const STATIC_PAGES: StaticPage[] = [
  { changeFrequency: "daily", path: "/", priority: 1 },
  { changeFrequency: "daily", path: "/article", priority: 0.9 },
  { changeFrequency: "weekly", path: "/archive", priority: 0.7 },
  { changeFrequency: "weekly", path: "/taxonomy", priority: 0.6 },
  { changeFrequency: "weekly", path: "/albums", priority: 0.7 },
  { changeFrequency: "monthly", path: "/docs", priority: 0.6 },
  { changeFrequency: "monthly", path: "/about", priority: 0.7 },
];

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const origin = await siteOrigin();

  const [posts, taxonomy, albums, profile] = await Promise.all([
    loadAllPosts(),
    serverCall.taxonomy.overview(),
    loadAlbums(),
    loadSiteProfile(),
  ]);

  const siteUpdated = profile?.updatedAt ?? new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    changeFrequency: page.changeFrequency,
    lastModified: siteUpdated,
    priority: page.priority,
    url: absoluteUrl(origin, page.path),
  }));

  for (const post of posts) {
    entries.push({
      changeFrequency: "monthly",
      lastModified: post.updatedAt ?? post.publishedAt ?? siteUpdated,
      priority: 0.8,
      url: absoluteUrl(origin, `/posts/${post.slug}`),
    });
  }

  for (const category of taxonomy.categories) {
    entries.push({
      changeFrequency: "weekly",
      lastModified: siteUpdated,
      priority: 0.5,
      url: absoluteUrl(origin, `/taxonomy/category/${category.slug}`),
    });
  }

  for (const tag of taxonomy.tags) {
    entries.push({
      changeFrequency: "weekly",
      lastModified: siteUpdated,
      priority: 0.4,
      url: absoluteUrl(origin, `/taxonomy/tag/${tag.slug}`),
    });
  }

  for (const album of albums) {
    const lastModified =
      album.date === null
        ? (album.publishedAt ?? siteUpdated)
        : new Date(`${album.date}T00:00:00+08:00`);

    entries.push({
      changeFrequency: "monthly",
      images: album.cover?.src === undefined ? undefined : [album.cover.src],
      lastModified,
      priority: 0.5,
      url: absoluteUrl(origin, `/albums/${album.slug}`),
    });
  }

  return entries;
};

export default sitemap;
