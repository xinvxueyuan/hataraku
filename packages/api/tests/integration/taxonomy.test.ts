import { describe, expect, it } from "vite-plus/test";

import { listTagsInput } from "#src/schemas.ts";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("taxonomy.categories", () => {
  it("counts only published, non-draft posts and orders by sortOrder", async () => {
    const categories = await client.taxonomy.categories();

    expect(categories.map((category) => category.slug)).toStrictEqual([
      "frontend",
      "backend",
    ]);
    expect(categories.map((category) => category.postCount)).toStrictEqual([
      2, 1,
    ]);
    expect(categories[0]).toMatchObject({ accent: "#FF3D8C", name: "前端" });
  });
});

describe("taxonomy.tags", () => {
  it("counts a tag by its published posts and hides one whose only post is a draft", async () => {
    const tags = await client.taxonomy.tags({});

    expect(tags.map((tag) => tag.slug)).toStrictEqual(["css", "react"]);
    expect(tags.map((tag) => tag.postCount)).toStrictEqual([1, 1]);
    expect(tags.map((tag) => tag.slug)).not.toContain("draft-only");
  });

  it("shows every tag when the minimum count is zero", async () => {
    const tags = await client.taxonomy.tags({ minCount: 0 });

    expect(tags.map((tag) => tag.slug)).toStrictEqual([
      "css",
      "react",
      "draft-only",
    ]);
  });

  it("orders by slug when asked", async () => {
    const tags = await client.taxonomy.tags({ minCount: 0, orderBy: "name" });

    expect(tags.map((tag) => tag.slug)).toStrictEqual([
      "css",
      "draft-only",
      "react",
    ]);
  });

  it("rejects a negative minimum with BAD_REQUEST", async () => {
    await expect(client.taxonomy.tags({ minCount: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  /** An unknown order field is not expressible in the client's type, so it is asserted at the schema. */
  it("rejects an unknown order field at the schema", () => {
    expect(listTagsInput.safeParse({ orderBy: "accent" }).success).toBeFalsy();
  });
});

describe("taxonomy.overview", () => {
  it("returns both axes plus the published post total", async () => {
    const overview = await client.taxonomy.overview();

    expect(overview.totalPosts).toBe(3);
    expect(overview.tags.map((tag) => tag.slug)).toStrictEqual([
      "css",
      "react",
      "draft-only",
    ]);
    expect(overview.categories).toHaveLength(2);
  });
});
