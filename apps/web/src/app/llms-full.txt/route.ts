import {
  describeSite,
  loadAllPosts,
  loadPostBody,
  loadSiteProfile,
} from "#src/components/site-content.ts";
import {
  absoluteUrl,
  dateOnly,
  excerptOf,
  SITE_LANGUAGE,
} from "#src/components/site.ts";

/**
 * `/llms-full.txt` — the index plus a readable excerpt of every article body.
 *
 * Bodies are markdown, so the excerpt goes through `stripMarkdown` first: an LLM reading this file
 * should get prose, not fence markers. The excerpt is capped rather than dumped whole — the full
 * body is always available at the article URL listed above it.
 */

export const dynamic = "force-dynamic";

const EXCERPT_LENGTH = 800;

const GET = async (): Promise<Response> => {
  const [profile, posts] = await Promise.all([
    loadSiteProfile(),
    loadAllPosts(),
  ]);

  const site = describeSite(profile);

  const bodies = await Promise.all(
    posts.map(
      async (post) => [post.slug, await loadPostBody(post.slug)] as const
    )
  );

  const bodyBySlug = new Map(bodies);

  const lines = [
    `# ${site.title}`,
    "",
    `> ${site.tagline}`,
    "",
    site.description,
    "",
    `站点: ${absoluteUrl("/")}`,
    `语言: ${SITE_LANGUAGE}`,
    `作者: ${site.author}`,
    `文章数: ${posts.length} 篇`,
    "",
    "---",
    "",
  ];

  if (posts.length === 0) {
    lines.push("（当前没有已发布文章。）", "");
  }

  for (const post of posts) {
    const url = absoluteUrl(`/posts/${post.slug}`);

    lines.push(`## ${post.title}`, "", `- URL: ${url}`);

    if (post.publishedAt !== null) {
      lines.push(`- 发布时间: ${dateOnly(post.publishedAt)}`);
    }

    if (post.updatedAt !== null) {
      lines.push(`- 更新时间: ${dateOnly(post.updatedAt)}`);
    }

    if (post.categorySlug !== null) {
      lines.push(`- 分类: ${post.categorySlug}`);
    }

    if (post.tags.length > 0) {
      lines.push(`- 标签: ${post.tags.join(", ")}`);
    }

    if (post.readingMinutes !== null) {
      lines.push(`- 阅读时长: ${post.readingMinutes} 分钟`);
    }

    lines.push("");

    if (post.description !== null) {
      lines.push(`> ${post.description.replaceAll(/\s+/gu, " ").trim()}`, "");
    }

    const body = bodyBySlug.get(post.slug) ?? null;
    const excerpt = body === null ? "" : excerptOf(body, EXCERPT_LENGTH);

    lines.push(
      excerpt === "" ? "（正文暂不可用）" : `正文摘要：${excerpt}`,
      "",
      "---",
      ""
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

export { GET };
