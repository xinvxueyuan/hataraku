import {
  describeSite,
  loadAlbums,
  loadAllPosts,
  loadSiteProfile,
} from "#src/components/site-content.ts";
import type { SitePost } from "#src/components/site-content.ts";
import {
  absoluteUrl,
  dateOnly,
  excerptOf,
  loadAllRows,
  SITE_LANGUAGE,
  siteOrigin,
} from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * /llms.txt — the site index an LLM can read in one request.
 *
 * The format follows llmstxt.org: an H1 name, a blockquote tagline, then short sections of links.
 * It is rendered per request from the same procedures the pages use, so the list cannot drift from
 * what a reader can actually open. Every content kind the site publishes has a section: a kind with
 * no rows yet disappears entirely rather than printing an empty heading.
 */

export const dynamic = "force-dynamic";

interface PageEntry {
  description: string;
  path: string;
  title: string;
}

const PAGES: PageEntry[] = [
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
    description: "短句、代码片段、图片与对话组成的碎片流",
    path: "/micro",
    title: "微文",
  },
  {
    description: "正在维护和已经交付的项目",
    path: "/projects",
    title: "项目",
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
  {
    description: "常用工具、设备与技能清单",
    path: "/toolbox",
    title: "工具箱",
  },
  {
    description: "站点与项目的版本变更记录",
    path: "/changelog",
    title: "更新日志",
  },
  { description: "站点的实现说明", path: "/docs", title: "文档" },
  {
    description: "站点介绍、内容概览与联系方式",
    path: "/about",
    title: "关于",
  },
  { description: "按关键词检索文章正文", path: "/search", title: "搜索" },
];

type TaxonomyOverview = Awaited<
  ReturnType<typeof serverCall.taxonomy.overview>
>;

type AlbumRow = Awaited<
  ReturnType<typeof serverCall.media.albums.list>
>["items"][number];

type MicroRow = Awaited<
  ReturnType<typeof serverCall.content.micro.list>
>["items"][number];

type ProjectRow = Awaited<
  ReturnType<typeof serverCall.content.projects.list>
>["items"][number];

type ToolRow = Awaited<
  ReturnType<typeof serverCall.content.tools.list>
>["items"][number];

type DeviceRow = Awaited<
  ReturnType<typeof serverCall.media.devices.list>
>["items"][number];

type ChangelogRow = Awaited<
  ReturnType<typeof serverCall.content.changelog.list>
>["items"][number];

/** One section, or nothing when the kind has no rows yet. */
const section = (title: string, rows: string[], note?: string): string[] => {
  if (rows.length === 0) {
    return [];
  }

  const lines = [`## ${title}`, "", ...rows];

  if (note !== undefined) {
    lines.push("", note);
  }

  lines.push("");

  return lines;
};

const pageRows = (origin: string): string[] =>
  PAGES.map(
    (page) =>
      `- [${page.title}](${absoluteUrl(origin, page.path)}): ${page.description}`
  );

const taxonomyRows = (origin: string, taxonomy: TaxonomyOverview) => ({
  categories: taxonomy.categories.map(
    (category) =>
      `- [${category.name}](${absoluteUrl(
        origin,
        `/taxonomy/category/${category.slug}`
      )}): ${category.postCount} 篇`
  ),
  tags: taxonomy.tags.map(
    (tag) =>
      `- [${tag.name}](${absoluteUrl(origin, `/taxonomy/tag/${tag.slug}`)}): ${
        tag.postCount
      } 篇`
  ),
});

const albumRows = (origin: string, albums: AlbumRow[]): string[] =>
  albums.map((album) => {
    const meta = [
      album.date,
      album.description === null ? null : excerptOf(album.description, 120),
    ].filter((part) => part !== null);

    return `- [${album.title}](${absoluteUrl(origin, `/albums/${album.slug}`)})${
      meta.length === 0 ? "" : `: ${meta.join(" — ")}`
    }`;
  });

const microRows = (micro: MicroRow[]): string[] =>
  micro.slice(0, 50).map((entry) => {
    const meta = [
      entry.publishedAt === null ? null : dateOnly(entry.publishedAt),
      excerptOf(entry.content, 120),
      entry.tags.length === 0
        ? null
        : entry.tags.map((tag) => `#${tag}`).join(" "),
    ].filter((part) => part !== null);

    return `- ${meta.join(" — ")}`;
  });

const microNote = (origin: string, micro: MicroRow[]): string =>
  `（共 ${micro.length} 条，全部列在 ${absoluteUrl(origin, "/micro")}。）`;

const projectRows = (projects: ProjectRow[]): string[] =>
  projects.map((project) => {
    const meta = [
      project.status,
      project.description === null ? null : excerptOf(project.description, 160),
      project.link,
    ].filter((part) => part !== null);

    return `- ${project.title}: ${meta.join(" — ")}`;
  });

const projectNote = (origin: string): string =>
  `（全部项目见 ${absoluteUrl(origin, "/projects")}。）`;

const toolboxRows = (tools: ToolRow[], devices: DeviceRow[]): string[] => [
  ...tools.map((tool) => {
    const meta = [
      tool.category,
      tool.description === null ? null : excerptOf(tool.description, 120),
    ].filter((part) => part !== null);

    return `- ${tool.name}: ${meta.join(" — ")}`;
  }),
  ...devices.map(
    (device) => `- ${device.name}: ${device.category} — ${device.status}`
  ),
];

const toolboxNote = (origin: string): string =>
  `（全部工具与设备见 ${absoluteUrl(origin, "/toolbox")}。）`;

const changelogRows = (changelog: ChangelogRow[]): string[] =>
  changelog.slice(0, 50).map((entry) => {
    const date = entry.releasedAt ?? dateOnly(entry.createdAt);

    const meta = [entry.title, `${entry.changes.length} 条变更`].filter(
      (part) => part !== null
    );

    return `- ${entry.version} — ${date} — ${meta.join(" — ")}`;
  });

const changelogNote = (origin: string, changelog: ChangelogRow[]): string =>
  `（共 ${changelog.length} 条，全部列在 ${absoluteUrl(origin, "/changelog")}。）`;

const postRows = (origin: string, posts: SitePost[]): string[] =>
  posts.map((post) => {
    const meta = [
      post.publishedAt === null ? null : dateOnly(post.publishedAt),
      post.description === null ? null : excerptOf(post.description, 160),
    ].filter((part) => part !== null);

    return `- [${post.title}](${absoluteUrl(origin, `/posts/${post.slug}`)})${
      meta.length === 0 ? "" : `: ${meta.join(" — ")}`
    }`;
  });

const GET = async (): Promise<Response> => {
  const origin = await siteOrigin();

  const [
    profile,
    posts,
    taxonomy,
    albums,
    micro,
    projects,
    tools,
    devices,
    changelog,
  ] = await Promise.all([
    loadSiteProfile(),
    loadAllPosts(),
    serverCall.taxonomy.overview(),
    loadAlbums(),
    loadAllRows(
      async (page) =>
        await serverCall.content.micro.list({ page, pageSize: 100 })
    ),
    loadAllRows(
      async (page) =>
        await serverCall.content.projects.list({ page, pageSize: 100 })
    ),
    loadAllRows(
      async (page) =>
        await serverCall.content.tools.list({ page, pageSize: 100 })
    ),
    loadAllRows(
      async (page) =>
        await serverCall.media.devices.list({ page, pageSize: 100 })
    ),
    loadAllRows(
      async (page) =>
        await serverCall.content.changelog.list({ page, pageSize: 100 })
    ),
  ]);

  const site = describeSite(profile);
  const taxonomySections = taxonomyRows(origin, taxonomy);

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
    `- 微文: ${micro.length} 条`,
    `- 项目: ${projects.length} 个`,
    `- 更新日志: ${changelog.length} 条`,
    "",
    "## 机器可读端点",
    "",
    `- RSS 2.0: ${absoluteUrl(origin, "/rss.xml")}`,
    `- Atom 1.0: ${absoluteUrl(origin, "/atom.xml")}`,
    `- Sitemap: ${absoluteUrl(origin, "/sitemap.xml")}`,
    `- robots.txt: ${absoluteUrl(origin, "/robots.txt")}`,
    `- LLMs 全量: ${absoluteUrl(origin, "/llms-full.txt")}`,
    "",
    ...section("主要页面", pageRows(origin)),
    ...section("分类", taxonomySections.categories),
    ...section("标签", taxonomySections.tags),
    ...section("相册", albumRows(origin, albums)),
    ...section("微文", microRows(micro), microNote(origin, micro)),
    ...section("项目", projectRows(projects), projectNote(origin)),
    ...section("工具箱", toolboxRows(tools, devices), toolboxNote(origin)),
    ...section(
      "更新日志",
      changelogRows(changelog),
      changelogNote(origin, changelog)
    ),
    ...section(
      "文章",
      postRows(origin, posts),
      posts.length === 0 ? "（当前没有已发布文章。）" : undefined
    ),
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

export { GET };
