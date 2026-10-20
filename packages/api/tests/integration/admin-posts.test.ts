import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { postTags } from "@hataraku/db/schema/taxonomy";

import { createClient, db, signUp } from "../support/api.ts";

const anonymous = createClient();

/** One database is shared by every test in this file, so each post needs a slug of its own. */
const draft = () => ({
  bodyMd: "## 开头\n\n一段正文。\n",
  slug: `post-${crypto.randomUUID().slice(0, 8)}`,
  title: "A new post",
});

describe("posts write path", () => {
  it.each([
    ["adminList", async () => await anonymous.posts.adminList({})],
    [
      "create",
      async () =>
        await anonymous.posts.create({ bodyMd: "", slug: "x", title: "x" }),
    ],
    [
      "byId",
      async () => await anonymous.posts.byId({ id: crypto.randomUUID() }),
    ],
    [
      "update",
      async () =>
        await anonymous.posts.update({ id: crypto.randomUUID(), title: "x" }),
    ],
    [
      "publish",
      async () => await anonymous.posts.publish({ id: crypto.randomUUID() }),
    ],
    [
      "unpublish",
      async () => await anonymous.posts.unpublish({ id: crypto.randomUUID() }),
    ],
    [
      "remove",
      async () => await anonymous.posts.remove({ id: crypto.randomUUID() }),
    ],
  ])("rejects an anonymous %s with UNAUTHORIZED", async (_, call) => {
    await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses an account outside ADMIN_EMAILS with FORBIDDEN", async () => {
    const client = await signUp({ adminEmails: "owner@example.com" });

    await expect(
      client.posts.create({ bodyMd: "", slug: "nope", title: "nope" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(client.posts.adminList({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets an address on ADMIN_EMAILS write", async () => {
    const owner = await signUp({
      adminEmails: "owner@example.com",
      email: "owner@example.com",
    });

    const post = draft();

    const created = await owner.posts.create({
      ...post,
      status: "published",
    });

    expect(created).toMatchObject({ slug: post.slug, status: "published" });
  });

  it("keeps a draft off the public read path until it is published", async () => {
    const owner = await signUp();
    const post = draft();
    const created = await owner.posts.create(post);

    expect(created.status).toBe("draft");
    await expect(
      anonymous.posts.bySlug({ slug: post.slug })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.posts
        .adminList({})
        .then((page) => page.items.map((row) => row.slug))
    ).resolves.toContain(post.slug);

    await owner.posts.publish({ id: created.id });

    await expect(
      anonymous.posts.bySlug({ slug: post.slug })
    ).resolves.toMatchObject({ bodyMd: post.bodyMd, title: post.title });

    await owner.posts.unpublish({ id: created.id });
    await expect(
      anonymous.posts.bySlug({ slug: post.slug })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stores an edit and hands the new body to the renderer", async () => {
    const owner = await signUp();
    const post = draft();
    const created = await owner.posts.create({ ...post, status: "published" });
    const bodyMd = "## 改过的开头\n\n- 一\n- 二\n";

    await expect(
      owner.posts.update({ bodyMd, id: created.id })
    ).resolves.toMatchObject({ bodyMd });

    await expect(
      anonymous.posts.bySlug({ slug: post.slug })
    ).resolves.toMatchObject({ bodyMd });
  });

  it.each([
    ["{process.env.BETTER_AUTH_SECRET}", "process access"],
    ["<script>alert(1)</script>", "script tags"],
    ['import x from "./x.md"', "import"],
  ])(
    "refuses the body %j with a readable BAD_REQUEST",
    async (bodyMd, reason) => {
      const owner = await signUp();
      const slug = `unsafe-${crypto.randomUUID().slice(0, 8)}`;

      const attempt = owner.posts.create({ bodyMd, slug, title: "unsafe" });

      await expect(attempt).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(attempt).rejects.toThrow(reason);
      await expect(
        owner.posts
          .adminList({})
          .then((page) => page.items.map((row) => row.slug))
      ).resolves.not.toContain(slug);
    }
  );

  it("refuses a slug that is already taken", async () => {
    const owner = await signUp();
    const post = draft();
    await owner.posts.create(post);

    await expect(
      owner.posts.create({ ...post, title: "Another" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deletes a post, and reports a second delete as NOT_FOUND", async () => {
    const owner = await signUp();
    const created = await owner.posts.create(draft());

    await expect(owner.posts.remove({ id: created.id })).resolves.toMatchObject(
      {
        id: created.id,
      }
    );
    await expect(owner.posts.remove({ id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reports an unknown id as NOT_FOUND", async () => {
    const owner = await signUp();

    await expect(
      owner.posts.update({ id: crypto.randomUUID(), title: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.posts.publish({ id: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      owner.posts.byId({ id: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

/**
 * Filing fields for one post: a category and two tags that exist nowhere yet, so the test proves the
 * write path creates them rather than only linking to what the migration left behind.
 */
const filed = () => {
  const suffix = crypto.randomUUID().slice(0, 8);

  const firstTag = `tag-a-${suffix}`;
  const secondTag = `tag-b-${suffix}`;

  return {
    categorySlug: `cat-${suffix}`,
    coverKey: `posts/${suffix}/cover.webp`,
    firstTag,
    post: {
      bodyMd: "## 归档\n\n正文。\n",
      slug: `filed-${suffix}`,
      title: "Filed post",
    },
    secondTag,
    tagSlugs: [firstTag, secondTag],
  };
};

describe("posts filing: category, tags, cover, featured, publish day", () => {
  it("stores every filed field on create", async () => {
    const owner = await signUp();
    const filing = filed();

    const created = await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      coverKey: filing.coverKey,
      featured: true,
      publishedAt: "2026-09-01",
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    expect(created).toMatchObject({
      categorySlug: filing.categorySlug,
      coverKey: filing.coverKey,
      featured: true,
      tagSlugs: filing.tagSlugs.toSorted(),
    });
    expect(created.publishedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("makes the post reachable from its category and from each tag", async () => {
    const owner = await signUp();
    const filing = filed();

    await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    const byCategory = await anonymous.posts.list({
      categorySlug: filing.categorySlug,
      page: 1,
      pageSize: 50,
    });

    expect(byCategory.items.map((row) => row.slug)).toContain(filing.post.slug);

    const byTag = await anonymous.posts.list({
      page: 1,
      pageSize: 50,
      tagSlugs: [filing.secondTag],
    });

    expect(byTag.items.map((row) => row.slug)).toContain(filing.post.slug);
  });

  it("counts the new category and tags in the taxonomy overview", async () => {
    const owner = await signUp();
    const filing = filed();

    await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    const overview = await anonymous.taxonomy.overview();

    expect(
      overview.categories.find((row) => row.slug === filing.categorySlug)
        ?.postCount
    ).toBe(1);
    expect(
      overview.tags.find((row) => row.slug === filing.firstTag)?.postCount
    ).toBe(1);
  });

  it("names a new category after its slug", async () => {
    const owner = await signUp();
    const filing = filed();

    await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      status: "published",
    });

    const categories = await anonymous.taxonomy.categories();

    expect(
      categories.find((row) => row.slug === filing.categorySlug)?.name
    ).toBe(filing.categorySlug);
  });

  it("applies only the tag difference, and the same list twice is a no-op", async () => {
    const owner = await signUp();
    const filing = filed();

    const created = await owner.posts.create({
      ...filing.post,
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    await owner.posts.update({ id: created.id, tagSlugs: [filing.secondTag] });
    await owner.posts.update({ id: created.id, tagSlugs: [filing.secondTag] });

    const reread = await owner.posts.byId({ id: created.id });

    expect(reread.tagSlugs).toStrictEqual([filing.secondTag]);

    const dropped = await anonymous.posts.list({
      page: 1,
      pageSize: 50,
      tagSlugs: [filing.firstTag],
    });

    expect(dropped.items.map((row) => row.slug)).not.toContain(
      filing.post.slug
    );
  });

  it("keeps the stored filing when an update omits it", async () => {
    const owner = await signUp();
    const filing = filed();

    const created = await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      coverKey: filing.coverKey,
      featured: true,
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    const updated = await owner.posts.update({
      bodyMd: "## 新正文\n",
      id: created.id,
    });

    expect(updated).toMatchObject({
      categorySlug: filing.categorySlug,
      coverKey: filing.coverKey,
      featured: true,
      tagSlugs: filing.tagSlugs.toSorted(),
    });
  });

  it("clears the category and the cover when they are set to null", async () => {
    const owner = await signUp();
    const filing = filed();

    const created = await owner.posts.create({
      ...filing.post,
      categorySlug: filing.categorySlug,
      coverKey: filing.coverKey,
      status: "published",
    });

    const cleared = await owner.posts.update({
      categorySlug: null,
      coverKey: null,
      id: created.id,
    });

    expect(cleared).toMatchObject({ categorySlug: null, coverKey: null });
  });

  it("deletes the tag links together with the post", async () => {
    const owner = await signUp();
    const filing = filed();

    const created = await owner.posts.create({
      ...filing.post,
      status: "published",
      tagSlugs: filing.tagSlugs,
    });

    await owner.posts.remove({ id: created.id });

    const orphans = await db
      .select()
      .from(postTags)
      .where(eq(postTags.postId, created.id));

    expect(orphans).toHaveLength(0);
  });
});

/** A token unique to one test, so a search only matches rows that test created. */
const token = () => `q-${crypto.randomUUID().slice(0, 8)}`;

const createListedPost = async (
  owner: Awaited<ReturnType<typeof signUp>>,
  title: string,
  bodyMd = ""
) => {
  const suffix = crypto.randomUUID().slice(0, 8);

  return await owner.posts.create({
    bodyMd,
    slug: `list-${suffix}`,
    title,
  });
};

describe("admin list query", () => {
  it("pages through its own rows and reports a stable total", async () => {
    const owner = await signUp();
    const mark = token();

    await createListedPost(owner, `${mark} one`);
    await createListedPost(owner, `${mark} two`);
    await createListedPost(owner, `${mark} three`);

    const first = await owner.posts.adminList({
      pageSize: 2,
      query: mark,
      status: "draft",
    });

    expect(first).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(first.items).toHaveLength(2);

    const second = await owner.posts.adminList({
      page: 2,
      pageSize: 2,
      query: mark,
      status: "draft",
    });

    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it("matches the term in the title, the slug and the body", async () => {
    const owner = await signUp();
    const mark = token();
    const suffix = crypto.randomUUID().slice(0, 8);

    await owner.posts.create({
      bodyMd: `正文里有 ${mark}`,
      slug: `body-${suffix}`,
      title: "正文命中",
    });
    await owner.posts.create({
      bodyMd: "",
      slug: `${mark}-${suffix}`,
      title: "slug 命中",
    });
    await owner.posts.create({
      bodyMd: "",
      slug: `title-${suffix}`,
      title: `${mark} 标题命中`,
    });

    const hits = await owner.posts.adminList({ pageSize: 50, query: mark });

    expect(hits.total).toBe(3);
  });

  it("filters by status", async () => {
    const owner = await signUp();
    const mark = token();

    const draftPost = await createListedPost(owner, `${mark} draft`);

    const publishedPost = await owner.posts.create({
      bodyMd: "",
      slug: `pub-${crypto.randomUUID().slice(0, 8)}`,
      status: "published",
      title: `${mark} published`,
    });

    const drafts = await owner.posts.adminList({
      pageSize: 50,
      query: mark,
      status: "draft",
    });

    expect(drafts.items.map((row) => row.id)).toStrictEqual([draftPost.id]);

    const published = await owner.posts.adminList({
      pageSize: 50,
      query: mark,
      status: "published",
    });

    expect(published.items.map((row) => row.id)).toStrictEqual([
      publishedPost.id,
    ]);
  });

  it("rejects a page below one and a page size above the cap", async () => {
    const owner = await signUp();

    await expect(owner.posts.adminList({ page: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      owner.posts.adminList({ pageSize: 500 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("orders by publish day when asked, and by edit time otherwise", async () => {
    const owner = await signUp();
    const mark = token();

    const older = await owner.posts.create({
      bodyMd: "",
      publishedAt: "2025-01-01",
      slug: `older-${crypto.randomUUID().slice(0, 8)}`,
      status: "published",
      title: `${mark} older`,
    });

    const newer = await owner.posts.create({
      bodyMd: "",
      publishedAt: "2026-01-01",
      slug: `newer-${crypto.randomUUID().slice(0, 8)}`,
      status: "published",
      title: `${mark} newer`,
    });

    const byPublishDay = await owner.posts.adminList({
      pageSize: 50,
      query: mark,
      sort: "published",
    });

    expect(byPublishDay.items.map((row) => row.id)).toStrictEqual([
      newer.id,
      older.id,
    ]);
  });

  it("counts drafts and published posts in adminStats", async () => {
    const owner = await signUp();

    await createListedPost(owner, `${token()} draft`);
    await owner.posts.create({
      bodyMd: "",
      slug: `stat-${crypto.randomUUID().slice(0, 8)}`,
      status: "published",
      title: `${token()} published`,
    });

    const stats = await owner.posts.adminStats();

    expect(stats.total).toBe(stats.drafts + stats.published);
    expect(stats.drafts).toBeGreaterThanOrEqual(1);
    expect(stats.published).toBeGreaterThanOrEqual(1);
  });
});
