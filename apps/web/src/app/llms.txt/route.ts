import {
  describeSite,
  loadAlbums,
  loadAllPosts,
  loadSiteProfile,
} from "#src/components/site-content.ts";
import {
  absoluteUrl,
  siteOrigin,
  dateOnly,
  excerptOf,
  SITE_LANGUAGE,
} from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * `/llms.txt` — the site index an LLM can read in one request.
 *
 * The format follows llmstxt.org: an H1 name, a blockquote tagline, then short sections of links.
 * It is rendered per request from the same procedures the pages use, so the list cannot drift from
 * what a reader can actually open.
 */

export const dynamic = "force-dynamic";

const PAGES = [
  { description: "最新文章、分类概览与站点自述", path: "/", title: "首页" },
  {
    description: "按时间排列并支持分类、标签筛选的文章列表",
    path: "/article",
    title: "文章列表",
  },
  {
    description: "全部文章按发布月份归档",
    path: "/archive",
    title: "归档",
  },
  {
    description: "全部分类与标签的索引",
    path: "/taxonomy",
    title: "分类与标签",
  },
  {
    description: "生活碎片与视觉练习的影像集",
    path: "/albums",
    title: "相册",
  },
  { description: "站点的实现说明", path: "/docs", title: "文档" },
  {
    description: "站点介绍、内容概览与联系方式",
    path: "/about",
    title: "关于",
  },
  { description: "按关键词检索文章正文", path: "/search", title: "搜索" },
] as const;

const GET = async (): Promise<Response> => {
  const origin = await siteOrigin();

  const [profile, posts, taxonomy, albums] = await Promise.all([
    loadSiteProfile(),
    loadAllPosts(),
    serverCall.taxonomy.overview(),
    loadAlbums(),
  ]);

  const site = describeSite(profile);

  const lines = [
    `# ${site.title}`,
    "",
    `> ${site.tagline}`,
    "",
    site.description,
    "",
    "## 站点信息",
    "",
    `- URL: ${absoluteUrl(origin, "/")}`,
    `- 语言: ${SITE_LANGUAGE}`,
    `- 作者: ${site.author}`,
    `- 联系: ${site.email}`,
    `- 已发布文章: ${posts.length} 篇`,
    `- 分类: ${taxonomy.categories.length} 个`,
    `- 标签: ${taxonomy.tags.length} 个`,
    `- 相册: ${albums.length} 本`,
    "",
    "## 机器可读端点",
    "",
    `- RSS 2.0: ${absoluteUrl(origin, "/rss.xml")}`,
    `- Atom 1.0: ${absoluteUrl(origin, "/atom.xml")}`,
    `- Sitemap: ${absoluteUrl(origin, "/sitemap.xml")}`,
    `- robots.txt: ${absoluteUrl(origin, "/robots.txt")}`,
    `- LLMs 全量: ${absoluteUrl(origin, "/llms-full.txt")}`,
    "",
    "## 主要页面",
    "",
  ];

  for (const page of PAGES) {
    lines.push(
      `- [${page.title}](${absoluteUrl(origin, page.path)}): ${page.description}`
    );
  }

  lines.push("");

  if (taxonomy.categories.length > 0) {
    lines.push("## 分类", "");

    for (const category of taxonomy.categories) {
      lines.push(
        `- [${category.name}](${absoluteUrl(
          origin,
          `/taxonomy/category/${category.slug}`
        )}): ${category.postCount} 篇`
      );
    }

    lines.push("");
  }

  if (taxonomy.tags.length > 0) {
    lines.push("## 标签", "");

    for (const tag of taxonomy.tags) {
      lines.push(
        `- [${tag.name}](${absoluteUrl(origin, `/taxonomy/tag/${tag.slug}`)}): ${
          tag.postCount
        } 篇`
      );
    }

    lines.push("");
  }

  if (albums.length > 0) {
    lines.push("## 相册", "");

    for (const album of albums) {
      const meta = [
        album.date,
        album.description === null ? null : excerptOf(album.description, 120),
      ].filter((part) => part !== null);

      lines.push(
        `- [${album.title}](${absoluteUrl(origin, `/albums/${album.slug}`)})${
          meta.length === 0 ? "" : `: ${meta.join(" — ")}`
        }`
      );
    }

    lines.push("");
  }

  if (posts.length > 0) {
    lines.push("## 文章", "");

    for (const post of posts) {
      const meta = [
        post.publishedAt === null ? null : dateOnly(post.publishedAt),
        post.description === null ? null : excerptOf(post.description, 160),
      ].filter((part) => part !== null);

      lines.push(
        `- [${post.title}](${absoluteUrl(origin, `/posts/${post.slug}`)})${
          meta.length === 0 ? "" : `: ${meta.join(" — ")}`
        }`
      );
    }

    lines.push("");
  } else {
    lines.push("（当前没有已发布文章。）", "");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

export { GET };
