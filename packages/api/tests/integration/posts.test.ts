import { describe, expect, it } from "vite-plus/test";

import { posts } from "@hataraku/db/schema/posts";

import { createPostInput, listPostsInput } from "#src/schemas.ts";

import { createClient, db } from "../support/api.ts";
import { RSC_BODY, seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("posts.list", () => {
  it("returns published, non-draft posts newest first, with their tags", async () => {
    const page = await client.posts.list({});

    expect(page.items.map((post) => post.slug)).toStrictEqual([
      "rsc",
      "oklch",
      "existence",
    ]);
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(1);
    expect(page.items[0]).toMatchObject({
      categorySlug: "frontend",
      coverKey: null,
      featured: true,
      readingMinutes: 12,
      tags: ["react"],
      title: "用 React Server Components 拆掉状态层",
    });
    expect(page.items[0]?.publishedAt).toBeInstanceOf(Date);
  });

  it("filters by category", async () => {
    const page = await client.posts.list({ categorySlug: "backend" });

    expect(page.items.map((post) => post.slug)).toStrictEqual(["existence"]);
  });

  it("filters by tag, matching any of the given slugs", async () => {
    const page = await client.posts.list({ tagSlugs: ["css"] });

    expect(page.items.map((post) => post.slug)).toStrictEqual(["oklch"]);
  });

  it("filters by featured", async () => {
    const page = await client.posts.list({ featuredOnly: true });

    expect(page.items.map((post) => post.slug)).toStrictEqual(["rsc"]);
  });

  it("sorts by title when asked", async () => {
    const page = await client.posts.list({ orderBy: "title" });

    const titles = page.items.map((post) => post.title);
    expect(titles).toStrictEqual(titles.toSorted());
  });

  it("pages with a limit and offset that agree with the total", async () => {
    const second = await client.posts.list({ page: 2, pageSize: 1 });

    expect(second.items.map((post) => post.slug)).toStrictEqual(["oklch"]);
    expect(second).toMatchObject({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
  });

  it("returns an empty page past the end without changing the total", async () => {
    const beyond = await client.posts.list({ page: 99, pageSize: 2 });

    expect(beyond.items).toStrictEqual([]);
    expect(beyond).toMatchObject({ page: 99, total: 3, totalPages: 2 });
  });

  it.each([
    ["page zero", { page: 0 }],
    ["a page size above the cap", { pageSize: 101 }],
    ["a page size below one", { pageSize: 0 }],
  ])("rejects %s with BAD_REQUEST", async (_, input) => {
    await expect(client.posts.list(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  /**
   * An unknown sort field cannot be expressed in the client's own type, so the contract is asserted
   * where it is declared: the schema the procedure validates against.
   */
  it.each([
    ["an unknown order field", { orderBy: "bodyMd" }],
    ["an unknown direction", { direction: "sideways" }],
  ])("rejects %s at the schema", (_, input) => {
    expect(listPostsInput.safeParse(input).success).toBeFalsy();
  });
});

describe("posts.byRef", () => {
  it("returns the body by numeric id", async () => {
    const page = await client.posts.list({});
    const id = page.items.find((post) => post.slug === "rsc")?.id;

    expect(id).toBeDefined();

    const post = await client.posts.byRef({ segment: String(id) });

    expect(post).toMatchObject({
      bodyMd: RSC_BODY,
      category: { accent: "#FF3D8C", name: "前端", slug: "frontend" },
      comment: true,
      slug: "rsc",
      slugOnly: false,
      tags: ["react"],
      views: 0,
    });
  });

  it("returns the body by slug", async () => {
    const post = await client.posts.byRef({ segment: "rsc" });

    expect(post).toMatchObject({ bodyMd: RSC_BODY, slug: "rsc" });
  });

  it.each(["missing", "99999999", "draft-post"])(
    "answers NOT_FOUND for %s",
    async (segment) => {
      await expect(client.posts.byRef({ segment })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  );

  it("answers NOT_FOUND for an old UUID segment (no compatibility alias)", async () => {
    await expect(
      client.posts.byRef({
        segment: "2f5a1f73-b5cc-4a8a-a156-72f8d61c637d",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides a slug-only post from its numeric id but serves it by slug", async () => {
    const [post] = await db
      .insert(posts)
      .values({
        bodyMd: "slug only",
        published: true,
        slug: "slug-only-post",
        slugOnly: true,
        title: "Slug only",
      })
      .returning();

    expect(post).toBeDefined();
    await expect(
      client.posts.byRef({ segment: String(post?.id) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.posts.byRef({ segment: "slug-only-post" })
    ).resolves.toMatchObject({ id: post?.id, slugOnly: true });
  });
});

describe("posts.adjacent", () => {
  it("walks the publish order around a post", async () => {
    const around = await client.posts.adjacent({ segment: "rsc" });

    expect(around.next).toBeNull();
    expect(around.previous?.slug).toBe("oklch");
  });

  it("returns both directions in the middle of the list", async () => {
    const around = await client.posts.adjacent({ segment: "oklch" });

    expect(around.next?.slug).toBe("rsc");
    expect(around.previous?.slug).toBe("existence");
  });

  it("returns nothing for a post that is not public", async () => {
    const around = await client.posts.adjacent({ segment: "draft-post" });

    expect(around).toStrictEqual({ next: null, previous: null });
  });
});

describe("posts.related", () => {
  it("returns a post sharing a category", async () => {
    const related = await client.posts.related({ segment: "rsc" });

    expect(related.map((post) => post.slug)).toStrictEqual(["oklch"]);
  });

  it("never returns the post itself", async () => {
    const related = await client.posts.related({ segment: "existence" });

    expect(related.map((post) => post.slug)).not.toContain("existence");
  });

  it("caps the limit", async () => {
    await expect(
      client.posts.related({ limit: 11, segment: "rsc" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("posts slug invariants", () => {
  it("rejects slugOnly without a slug in the database", async () => {
    await expect(
      db.insert(posts).values({
        bodyMd: "",
        slugOnly: true,
        title: "db rejects",
      })
    ).rejects.toThrow('Failed query: insert into "posts"');
  });

  it("rejects slugOnly without a slug in the input schema", () => {
    const parsed = createPostInput.safeParse({
      slugOnly: true,
      title: "zod rejects",
    });

    expect(parsed.success).toBeFalsy();
  });

  it("allows several posts with no slug", async () => {
    const inserted = await db
      .insert(posts)
      .values([
        { bodyMd: "", slug: null, title: "no slug one" },
        { bodyMd: "", slug: null, title: "no slug two" },
      ])
      .returning({ id: posts.id });

    expect(inserted).toHaveLength(2);
    expect(new Set(inserted.map((row) => row.id)).size).toBe(2);
  });
});
