import {
  describeSite,
  loadDatedPosts,
  loadSiteProfile,
  newestStamp,
} from "#src/components/site-content.ts";
import {
  absoluteUrl,
  siteOrigin,
  escapeXml,
  rfc3339,
  SITE_LANGUAGE,
} from "#src/components/site.ts";

/**
 * Atom 1.0 over the same rows as `/rss.xml`.
 *
 * Entry ids are the article's absolute URL (stable, resolvable), and `updated` falls back to the
 * publish time when an article has never been edited — both are required by RFC 4287.
 */

export const dynamic = "force-dynamic";

const FEED_PATH = "/atom.xml";

const GET = async (): Promise<Response> => {
  const origin = await siteOrigin();

  const [posts, profile] = await Promise.all([
    loadDatedPosts(),
    loadSiteProfile(),
  ]);

  const site = describeSite(profile);

  const newest = newestStamp(posts);

  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(
      SITE_LANGUAGE
    )}">`,
    `  <title>${escapeXml(site.title)}</title>`,
    `  <subtitle>${escapeXml(site.description)}</subtitle>`,
    `  <link href="${escapeXml(
      absoluteUrl(origin, FEED_PATH)
    )}" rel="self" type="application/atom+xml" />`,
    `  <link href="${escapeXml(
      absoluteUrl(origin, "/")
    )}" rel="alternate" type="text/html" />`,
    `  <id>${escapeXml(absoluteUrl(origin, "/"))}</id>`,
  ];

  if (newest !== null) {
    lines.push(`  <updated>${escapeXml(rfc3339(newest))}</updated>`);
  }

  lines.push(
    "  <generator>hataraku</generator>",
    `  <author><name>${escapeXml(site.author)}</name><email>${escapeXml(
      site.email
    )}</email></author>`
  );

  for (const post of posts) {
    const link = absoluteUrl(origin, `/posts/${post.slug}`);
    const updated = post.updatedAt ?? post.publishedAt;

    lines.push(
      "  <entry>",
      `    <title>${escapeXml(post.title)}</title>`,
      `    <link href="${escapeXml(link)}" rel="alternate" type="text/html" />`,
      `    <id>${escapeXml(link)}</id>`,
      `    <published>${escapeXml(rfc3339(post.publishedAt))}</published>`,
      `    <updated>${escapeXml(rfc3339(updated))}</updated>`,
      `    <summary type="text">${escapeXml(post.description ?? "")}</summary>`
    );

    if (post.categorySlug !== null) {
      lines.push(`    <category term="${escapeXml(post.categorySlug)}" />`);
    }

    for (const tag of post.tags) {
      lines.push(`    <category term="${escapeXml(tag)}" />`);
    }

    lines.push("  </entry>");
  }

  lines.push("</feed>", "");

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "application/atom+xml; charset=utf-8",
    },
  });
};

export { GET };
