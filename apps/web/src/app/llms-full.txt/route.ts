import { contentPath, contentSegment } from "#src/components/content-path.ts";
import {
  describeSite,
  loadAllPosts,
  loadPostBody,
  loadSiteProfile,
} from "#src/components/site-content.ts";
import type { SitePost } from "#src/components/site-content.ts";
import {
  absoluteUrl,
  dateOnly,
  loadAllRows,
  SITE_LANGUAGE,
  siteOrigin,
} from "#src/components/site.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * /llms-full.txt — a full-content snapshot for a single ingest.
 *
 * Article bodies are written out in full, matching the v2 behaviour: an LLM that has to fetch each
 * article separately is not better served by an excerpt. The size is bounded by capping how many
 * rows of each kind are included (v2 capped articles at 50), and the header states the
 * included/available counts so the truncation is visible rather than silent.
 */

export const dynamic = "force-dynamic";

const POST_LIMIT = 50;
const MICRO_LIMIT = 100;
const CHANGELOG_LIMIT = 100;

type MicroRow = Awaited<
  ReturnType<typeof serverCall.content.micro.list>
>["items"][number];

type ChangelogRow = Awaited<
  ReturnType<typeof serverCall.content.changelog.list>
>["items"][number];

const postLines = (post: SitePost, body: string, origin: string): string[] => {
  const lines = [
    `## ${post.title}`,
    "",
    `- URL: ${absoluteUrl(origin, contentPath("/blog", post))}`,
  ];

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

  lines.push(body === "" ? "（正文暂不可用）" : body, "", "---", "");

  return lines;
};

const microLines = (entry: MicroRow): string[] => {
  const meta = [
    entry.publishedAt === null ? "未标注" : dateOnly(entry.publishedAt),
    entry.type,
    entry.tags.length === 0 ? null : `标签: ${entry.tags.join(", ")}`,
  ].filter((part) => part !== null);

  return [
    `## 微言：${entry.slug}`,
    "",
    ...meta.map((part) => `- ${part}`),
    "",
    entry.content.trim(),
    "",
    "---",
    "",
  ];
};

const changelogLines = (entry: ChangelogRow): string[] => {
  const lines = [`## 更新日志：${entry.version}`, ""];

  lines.push(`- 日期: ${entry.releasedAt ?? dateOnly(entry.createdAt)}`);

  if (entry.title !== null) {
    lines.push(`- 标题: ${entry.title}`);
  }

  if (entry.highlight) {
    lines.push("- 重点版本");
  }

  lines.push("");

  for (const change of entry.changes) {
    lines.push(`- ${change}`);
  }

  if (entry.changes.length > 0) {
    lines.push("");
  }

  if (entry.bodyMd !== null && entry.bodyMd.trim() !== "") {
    lines.push(entry.bodyMd.trim(), "");
  }

  lines.push("---", "");

  return lines;
};

const GET = async (): Promise<Response> => {
  const origin = await siteOrigin();

  const [profile, posts, micro, changelog] = await Promise.all([
    loadSiteProfile(),
    loadAllPosts(),
    loadAllRows(
      async (page) =>
        await serverCall.content.micro.list({ page, pageSize: 100 })
    ),
    loadAllRows(
      async (page) =>
        await serverCall.content.changelog.list({ page, pageSize: 100 })
    ),
  ]);

  const site = describeSite(profile);
  const latest = posts.slice(0, POST_LIMIT);

  const bodies = new Map(
    await Promise.all(
      latest.map(
        async (post) =>
          [
            contentSegment(post),
            await loadPostBody(contentSegment(post)),
          ] as const
      )
    )
  );

  const lines = [
    `# ${site.title}`,
    "",
    `> ${site.tagline}`,
    "",
    site.description,
    "",
    `站点: ${absoluteUrl(origin, "/")}`,
    `语言: ${SITE_LANGUAGE}`,
    `作者: ${site.author}`,
    `文章数: ${latest.length} / 全站 ${posts.length}`,
    `微言: ${Math.min(micro.length, MICRO_LIMIT)} / 全站 ${micro.length}`,
    `更新日志: ${Math.min(changelog.length, CHANGELOG_LIMIT)} / 全站 ${changelog.length}`,
    "",
    "---",
    "",
  ];

  if (latest.length === 0) {
    lines.push("（当前没有已发布文章。）", "");
  }

  for (const post of latest) {
    lines.push(
      ...postLines(post, bodies.get(contentSegment(post))?.trim() ?? "", origin)
    );
  }

  for (const entry of micro.slice(0, MICRO_LIMIT)) {
    lines.push(...microLines(entry));
  }

  for (const entry of changelog.slice(0, CHANGELOG_LIMIT)) {
    lines.push(...changelogLines(entry));
  }

  return new Response(lines.join("\n"), {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};

export { GET };
