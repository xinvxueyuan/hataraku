import { describe, expect, it } from "vite-plus/test";

import { createSearchIndex } from "#src/search/orama.ts";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

const slugs = async (q: string) => {
  const result = await client.search.query({ q });

  return result.items.map((hit) => hit.slug);
};

describe("search.query", () => {
  it("finds an ASCII term", async () => {
    const result = await client.search.query({ q: "React" });

    expect(result.items.map((hit) => hit.slug)).toContain("rsc");
    expect(result.query).toBe("React");
    expect(result).not.toHaveProperty("fallback");
  });

  it("matches an ASCII prefix, so a half-typed word already finds the post", async () => {
    await expect(slugs("Rea")).resolves.toContain("rsc");
    await expect(slugs("monorep")).resolves.toContain("rsc");
    await expect(slugs("okl")).resolves.toContain("oklch");
  });

  it.each(["限流", "网关", "限流网关", "状态层"])(
    "finds the Chinese run in the body with %j",
    async (q) => {
      await expect(slugs(q)).resolves.toContain("rsc");
    }
  );

  it("matches a single Chinese character", async () => {
    await expect(slugs("限")).resolves.toContain("rsc");
    await expect(slugs("网")).resolves.toContain("rsc");
  });

  /**
   * The regression this file exists for. 「存在」 lives in another post, so a filter that only
   * shares tokens would return it; the AND across every token (and its prefix) keeps the result 0.
   */
  it("returns nothing for a phrase that only shares tokens with other posts", async () => {
    const result = await client.search.query({ q: "不存在的词xyz" });

    expect(result.items).toStrictEqual([]);
    expect(result.total).toBe(0);
  });

  it("does not return a draft", async () => {
    const result = await client.search.query({ q: "草稿正文" });

    expect(result.items).toStrictEqual([]);
  });

  it.each(["a & b", "x:y", "' OR 1=1--", "!", "(", "*", "\\", "a&b"])(
    "treats %j as data, not as tsquery syntax",
    async (q) => {
      const result = await client.search.query({ q });

      expect(result.query).toBe(q);
      expect(result.total).toBeTypeOf("number");
    }
  );

  it("ranks the hit and reports a page envelope", async () => {
    const result = await client.search.query({ pageSize: 1, q: "React" });

    expect(result.items[0]?.rank).toBeGreaterThan(0);
    expect(result).toMatchObject({ page: 1, pageSize: 1, totalPages: 1 });
  });

  it("keeps the target post first for a Chinese query", async () => {
    const result = await client.search.query({ q: "限流" });

    expect(result.items[0]?.slug).toBe("rsc");
  });

  it("treats a blank query as no query at all", async () => {
    const result = await client.search.query({ q: "   " });

    expect(result).toMatchObject({ query: "", total: 0 });
  });

  it("returns an empty page past the end", async () => {
    const result = await client.search.query({
      page: 5,
      pageSize: 1,
      q: "React",
    });

    expect(result.items).toStrictEqual([]);
    expect(result.total).toBe(1);
  });

  it("rejects a page size above the cap", async () => {
    await expect(
      client.search.query({ pageSize: 101, q: "React" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("indexes published, non-draft posts only", async () => {
    const { documentCount } = await createSearchIndex(db);

    // rsc, oklch and existence are published; the draft post is not.
    expect(documentCount).toBe(3);
  });
});
