import {
  describeSite,
  loadDatedPosts,
  loadSiteProfile,
  newestStamp,
} from "#src/components/site-content.ts";
import {
  absoluteUrl,
  escapeXml,
  rfc822,
  SITE_LANGUAGE,
} from "#src/components/site.ts";

/**
 * RSS 2.0, one item per published article that has a publish date.
 *
 * The feed is rendered per request (`force-dynamic`): its content is the database, and a stale
 * feed is worse than a slightly slower request. Timestamps are RFC 822 in the site's +08:00 zone,
 * so a reader sees the same wall clock the article page does.
 */

export const dynamic = "force-dynamic";

const FEED_PATH = "/rss.xml";

const GET = async (): Promise<Response> => {
  const [posts, profile] = await Promise.all([
    loadDatedPosts(),
    loadSiteProfile(),
  ]);

  const site = describeSite(profile);

  const newest = newestStamp(posts);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(site.title)}</title>`,
    `    <link>${escapeXml(absoluteUrl("/"))}</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    `    <language>${escapeXml(SITE_LANGUAGE)}</language>`,
    "    <generator>hataraku</generator>",
    "    <ttl>60</ttl>",
  ];

  if (newest !== null) {
    lines.push(
      `    <lastBuildDate>${escapeXml(rfc822(newest))}</lastBuildDate>`
    );
  }

  lines.push(
    `    <atom:link href="${escapeXml(
      absoluteUrl(FEED_PATH)
    )}" rel="self" type="application/rss+xml" />`,
    `    <managingEditor>${escapeXml(
      `${site.email} (${site.author})`
    )}</managingEditor>`,
    `    <webMaster>${escapeXml(`${site.email} (${site.author})`)}</webMaster>`
  );

  for (const post of posts) {
    const link = absoluteUrl(`/posts/${post.slug}`);
    const summary = post.description ?? "";

    lines.push(
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <pubDate>${escapeXml(rfc822(post.publishedAt))}</pubDate>`,
      `      <description>${escapeXml(summary)}</description>`
    );

    if (post.categorySlug !== null) {
      lines.push(`      <category>${escapeXml(post.categorySlug)}</category>`);
    }

    for (const tag of post.tags) {
      lines.push(`      <category>${escapeXml(tag)}</category>`);
    }

    lines.push("    </item>");
  }

  lines.push("  </channel>", "</rss>", "");

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
};

export { GET };
