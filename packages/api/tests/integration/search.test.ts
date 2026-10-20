import { describe, expect, it } from "vite-plus/test";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("search.query", () => {
  it("finds an ASCII term", async () => {
    const result = await client.search.query({ q: "React" });

    expect(result.items.map((hit) => hit.slug)).toContain("rsc");
    expect(result.fallback).toBeFalsy();
    expect(result.query).toBe("React");
  });

  it.each(["限流", "网关", "限流网关", "状态层"])(
    "finds the Chinese run in the body with %j",
    async (q) => {
      const result = await client.search.query({ q });

      expect(result.items.map((hit) => hit.slug)).toContain("rsc");
    }
  );

  /**
   * The regression this file exists for. 「存在」 lives in another post, so an unconditional OR
   * pass over the query's 2-grams would return it; the AND-first pass finds nothing and the
   * term-count gate refuses the fallback.
   */
  it("returns nothing for a phrase that only shares 2-grams with other posts", async () => {
    const result = await client.search.query({ q: "不存在的词xyz" });

    expect(result.items).toStrictEqual([]);
    expect(result.total).toBe(0);
    expect(result.fallback).toBeFalsy();
  });

  it("does not return a draft", async () => {
    const result = await client.search.query({ q: "草稿正文" });

    expect(result.items).toStrictEqual([]);
  });

  it("relaxes to OR only when the AND pass is empty and the query is short", async () => {
    const result = await client.search.query({ q: "限流xyz" });

    expect(result.fallback).toBeTruthy();
    expect(result.items.map((hit) => hit.slug)).toStrictEqual(["rsc"]);
  });

  it("ranks the hit and reports a page envelope", async () => {
    const result = await client.search.query({ pageSize: 1, q: "React" });

    expect(result.items[0]?.rank).toBeGreaterThan(0);
    expect(result).toMatchObject({ page: 1, pageSize: 1, totalPages: 1 });
  });

  it("treats a blank query as no query at all", async () => {
    const result = await client.search.query({ q: "   " });

    expect(result).toMatchObject({ fallback: false, query: "", total: 0 });
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
});
