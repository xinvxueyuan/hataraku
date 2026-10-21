import type { Database } from "@hataraku/db";
import {
  changelogEntries,
  friends,
  microPosts,
  projects,
  skills,
  tools,
} from "@hataraku/db/schema/content";
import { albumPhotos, albums, devices } from "@hataraku/db/schema/media";
import {
  diaryEntries,
  siteProfile,
  timelineEntries,
} from "@hataraku/db/schema/pages";
import { posts } from "@hataraku/db/schema/posts";
import { categories, postTags, tags } from "@hataraku/db/schema/taxonomy";

/** The inserted row, or a loud failure: a fixture that silently produced nothing would make
 * every later assertion meaningless. */
const one = <T>(rows: T[]): T => {
  const [row] = rows;

  if (row === undefined) {
    throw new Error("Fixture insert returned no row");
  }

  return row;
};

/**
 * One fixture set for the blog read path. Values are chosen so an assertion can name a regression:
 *
 * - `rsc` carries the Chinese run 「限流网关与」 in its body, which PostgreSQL's built-in parser
 *   stores as one lexeme — the case the CJK n-gram patch exists for.
 * - `existence` carries 「存在」. It is the document an unconditional OR pass would wrongly return
 *   for the query 「不存在的词xyz」, so the precision test only means something while it is here.
 * - `draft` is unpublished and is the only post on `draft-only`, which pins the tag cloud rule.
 */
/**
 * Body of the \`rsc\` fixture.
 *
 * Exported so a test that asserts the stored body reads the same value the seed wrote; changing the
 * fixture then cannot leave a second hard-coded copy behind.
 */
export const RSC_BODY =
  "状态层有三个来源。限流网关与 monorepo 也会影响。supercalifragilisticexpialidocious 与 <b>& 符号。";

export const seedBlog = async (db: Database) => {
  const frontend = one(
    await db
      .insert(categories)
      .values({
        accent: "#FF3D8C",
        description: "界面与浏览器",
        name: "前端",
        slug: "frontend",
      })
      .returning()
  );

  const backend = one(
    await db
      .insert(categories)
      .values({ name: "后端", slug: "backend", sortOrder: 1 })
      .returning()
  );

  const react = one(
    await db.insert(tags).values({ name: "React", slug: "react" }).returning()
  );

  const css = one(
    await db.insert(tags).values({ name: "CSS", slug: "css" }).returning()
  );

  const draftOnly = one(
    await db
      .insert(tags)
      .values({ name: "Draft only", slug: "draft-only" })
      .returning()
  );

  const rsc = one(
    await db
      .insert(posts)
      .values({
        bodyMd: RSC_BODY,
        categoryId: frontend.id,
        categorySlug: frontend.slug,
        cover: { alt: "封面", height: 630, src: "/rsc.webp", width: 1200 },
        description: "RSC 不是银弹",
        featured: true,
        published: true,
        publishedAt: new Date("2026-07-10T00:00:00Z"),
        readingMinutes: 12,
        slug: "rsc",
        title: "用 React Server Components 拆掉状态层",
      })
      .returning()
  );

  const oklch = one(
    await db
      .insert(posts)
      .values({
        bodyMd: "oklch 色空间的笔记。",
        categoryId: frontend.id,
        categorySlug: frontend.slug,
        published: true,
        publishedAt: new Date("2026-07-01T00:00:00Z"),
        slug: "oklch",
        title: "用 oklch() 构建感知均匀的暗色主题",
      })
      .returning()
  );

  // The document an unconditional OR pass would return for 「不存在的词xyz」.
  const existence = one(
    await db
      .insert(posts)
      .values({
        bodyMd: "讨论问题的存在与解法，以及后端网关的取舍。",
        categoryId: backend.id,
        categorySlug: backend.slug,
        published: true,
        publishedAt: new Date("2026-06-01T00:00:00Z"),
        slug: "existence",
        title: "问题的存在与解法",
      })
      .returning()
  );

  const draft = one(
    await db
      .insert(posts)
      .values({
        bodyMd: "草稿正文，不该被公开读路径看到。",
        draft: true,
        published: false,
        slug: "draft-post",
        title: "草稿",
      })
      .returning()
  );

  await db.insert(postTags).values([
    { postId: rsc.id, tagId: react.id },
    { postId: oklch.id, tagId: css.id },
    { postId: draft.id, tagId: draftOnly.id },
  ]);

  const project = one(
    await db
      .insert(projects)
      .values({
        description: "流场粒子生成艺术工具",
        featured: true,
        link: "https://example.com/flow",
        published: true,
        publishedAt: new Date("2026-05-01T00:00:00Z"),
        slug: "flow-field",
        sortOrder: 0,
        status: "active",
        tags: ["p5.js", "Canvas"],
        title: "Flow Field Studio",
      })
      .returning()
  );

  const archivedProject = one(
    await db
      .insert(projects)
      .values({
        published: true,
        slug: "murmur",
        sortOrder: 1,
        status: "archived",
        title: "Murmur",
      })
      .returning()
  );

  await db.insert(microPosts).values([
    {
      content: "v3.0 上线了。",
      published: true,
      publishedAt: new Date("2026-07-18T00:00:00Z"),
      slug: "micro-text",
      type: "text",
    },
    {
      content: "正在听：Nujabes",
      music: { artist: "Nujabes", track: "Luv(sic) Part 3" },
      published: true,
      publishedAt: new Date("2026-07-08T00:00:00Z"),
      slug: "micro-music",
      type: "music",
    },
  ]);

  await db.insert(changelogEntries).values([
    {
      changes: ["迁移到 Next.js", "斜切 Hero"],
      highlight: true,
      releasedAt: "2026-07-18",
      slug: "v3",
      version: "v3.0",
    },
    {
      changes: ["扩展到 10 个页面"],
      releasedAt: "2026-06-20",
      slug: "v2",
      version: "v2.0",
    },
  ]);

  await db.insert(tools).values([
    {
      category: "dev",
      name: "VS Code",
      published: true,
      slug: "vscode",
      sortOrder: 0,
    },
    {
      category: "design",
      name: "Figma",
      published: true,
      slug: "figma",
      sortOrder: 1,
    },
  ]);

  await db.insert(friends).values([
    {
      name: "张三的博客",
      published: true,
      slug: "zhangsan",
      sortOrder: 0,
      url: "https://a.example",
    },
    {
      name: "李四的栈",
      published: true,
      slug: "lisi",
      sortOrder: 1,
      url: "https://b.example",
    },
  ]);

  await db.insert(skills).values([
    {
      category: "frontend",
      level: 90,
      name: "TypeScript",
      slug: "typescript",
      sortOrder: 0,
    },
    {
      category: "backend",
      level: 70,
      name: "PostgreSQL",
      slug: "postgresql",
      sortOrder: 1,
    },
  ]);

  const album = one(
    await db
      .insert(albums)
      .values({
        coverKey: "albums/japan/cover.webp",
        date: "2026-04-01",
        published: true,
        publishedAt: new Date("2026-04-01T00:00:00Z"),
        slug: "japan",
        tags: ["travel"],
        title: "日本 2026",
      })
      .returning()
  );

  await db.insert(albums).values({
    date: "2026-03-01",
    published: true,
    slug: "city",
    title: "城市",
  });

  await db.insert(albumPhotos).values([
    {
      albumId: album.id,
      height: 900,
      imageKey: "albums/japan/1.webp",
      sortOrder: 0,
      title: "第一天",
      width: 1600,
    },
    {
      albumId: album.id,
      height: 900,
      imageKey: "albums/japan/2.webp",
      sortOrder: 1,
      width: 1600,
    },
  ]);

  await db.insert(devices).values([
    {
      category: "laptop",
      name: "MacBook Pro",
      published: true,
      slug: "macbook",
      sortOrder: 0,
    },
    {
      category: "phone",
      name: "Pixel",
      published: true,
      slug: "pixel",
      sortOrder: 1,
    },
  ]);

  await db.insert(diaryEntries).values([
    {
      content: "今天把流场调好了。",
      date: "2026-06-25",
      published: true,
      publishedAt: new Date("2026-06-25T00:00:00Z"),
      slug: "diary-1",
      tags: ["dev"],
    },
    {
      content: "雨天，读书。",
      date: "2026-06-20",
      published: true,
      publishedAt: new Date("2026-06-20T00:00:00Z"),
      slug: "diary-2",
      tags: ["life"],
    },
  ]);

  await db.insert(timelineEntries).values([
    {
      category: "milestone",
      date: "2026-06-01",
      published: true,
      slug: "v1",
      sortOrder: 0,
      title: "v1.0 发布",
    },
    {
      category: "life",
      date: "2026-05-01",
      published: true,
      slug: "moved",
      sortOrder: 0,
      title: "搬了新家",
    },
  ]);

  await db.insert(siteProfile).values({
    author: "xinvStar",
    description: "夜行栈",
    hero: { badge: "全栈工程", cta: "阅读最新文章", ctaHref: "/blog" },
    id: 1,
    name: "夜行栈",
    nameEn: "NightStack",
    nav: { cta: { href: "/article", label: "进入栈内" } },
    social: { github: "https://github.com/xinvxueyuan", rss: "/rss.xml" },
    tagline: "昼构建夜沉思",
  });

  return {
    album,
    archivedProject,
    backend,
    css,
    draft,
    draftOnly,
    existence,
    frontend,
    oklch,
    project,
    react,
    rsc,
  };
};
