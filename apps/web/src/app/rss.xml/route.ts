import {
  describeSite,
  loadDatedPosts,
  loadPostBody,
  loadSiteProfile,
  newestStamp,
} from "#src/components/site-content.ts";
import {
  absoluteUrl,
  siteOrigin,
  escapeXml,
  excerptOf,
  rfc822,
  SITE_LANGUAGE,
} from "#src/components/site.ts";

/**
 * RSS 2.0, one item per published article that has a publish date.
 *
 * `content:encoded` carries the article body, matching v2: a subscriber that has to open the site to
 * read a post is not being served by the feed. The body is escaped markdown text, not raw HTML, so
 * the document stays well-formed for any parser. The item count is capped like v2 (20) to keep the
 * full-text feed a reasonable size.
 *
 * The feed is rendered per request (`force-dynamic`): its content is the database, and a stale
 * feed is worse than a slightly slower request. Timestamps are RFC 822 in the site's +08:00 zone,
 * so a reader sees the same wall clock the article page does.
 */

export const dynamic = "force-dynamic";

const FEED_PATH = "/rss.xml";
const FEED_ITEM_LIMIT = 20;

const GET = async (): Promise<Response> => {
  const origin = await siteOrigin();

  const [posts, profile] = await Promise.all([
    loadDatedPosts(),
    loadSiteProfile(),
  ]);

  const site = describeSite(profile);
  const latest = posts.slice(0, FEED_ITEM_LIMIT);

  const bodies = new Map(
    await Promise.all(
      latest.map(
        async (post) => [post.slug, await loadPostBody(post.slug)] as const
      )
    )
  );

  const newest = newestStamp(latest);

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "  <channel>",
    `    <title>${escapeXml(site.title)}</title>`,
    `    <link>${escapeXml(absoluteUrl(origin, "/"))}</link>`,
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
      absoluteUrl(origin, FEED_PATH)
    )}" rel="self" type="application/rss+xml" />`,
    `    <managingEditor>${escapeXml(
      `${site.email} (${site.author})`
    )}</managingEditor>`,
    `    <webMaster>${escapeXml(`${site.email} (${site.author})`)}</webMaster>`
  );

  for (const post of latest) {
    const link = absoluteUrl(origin, `/posts/${post.slug}`);
    const body = bodies.get(post.slug)?.trim() ?? "";

    const summary =
      post.description ?? (body === "" ? "" : excerptOf(body, 240));

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

    if (body !== "") {
      lines.push(`      <content:encoded>${escapeXml(body)}</content:encoded>`);
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
