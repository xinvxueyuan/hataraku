import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { posts } from "@hataraku/db/schema/posts";

import { createSearchIndex } from "#src/search/orama.ts";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

const slugs = async (q: string) => {
  const result = await client.search.query({ q });

  return result.items.map((hit) => hit.slug);
};

const rscHit = async (q: string) => {
  const result = await client.search.query({ q });

  return result.items.find((hit) => hit.slug === "rsc");
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
    expect(result.items[0]?.id).toBeTypeOf("number");
    expect(result.items[0]).toMatchObject({ slug: "rsc", slugOnly: false });
    expect(result).toMatchObject({ page: 1, pageSize: 1, totalPages: 1 });
  });

  it("keeps the target post first for a Chinese query", async () => {
    const result = await client.search.query({ q: "限流" });

    expect(result.items[0]?.slug).toBe("rsc");
  });

  it("returns the article-list context with each hit", async () => {
    const hit = await rscHit("React");

    expect(hit).toMatchObject({ categorySlug: "frontend", slug: "rsc" });
    expect(hit?.tags).toContain("react");
    expect(hit?.readingMinutes).toBeTypeOf("number");
  });

  it("breaks a relevance tie by publish date, newest first", async () => {
    const token = `tiebreak${Date.now()}`;

    const common = {
      bodyMd: token,
      description: token,
      published: true,
      title: "Tie break probe",
    };

    const rows = await db
      .insert(posts)
      .values([
        {
          ...common,
          publishedAt: new Date("2020-01-01T00:00:00.000Z"),
          slug: `tie-old-${token}`,
        },
        {
          ...common,
          publishedAt: new Date("2021-01-01T00:00:00.000Z"),
          slug: `tie-new-${token}`,
        },
      ])
      .returning({ id: posts.id, slug: posts.slug });

    try {
      const result = await client.search.query({ q: token });

      const hits = result.items.filter((item) =>
        rows.some((row) => row.id === item.id)
      );

      expect(hits).toHaveLength(2);
      expect(hits[0]?.rank).toBe(hits[1]?.rank);
      expect(hits.map((hit) => hit.slug)).toStrictEqual([
        rows[1]?.slug,
        rows[0]?.slug,
      ]);
    } finally {
      await db.delete(posts).where(
        inArray(
          posts.id,
          rows.map((row) => row.id)
        )
      );
    }
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

  it("returns a body snippet when the title and summary do not carry the query", async () => {
    const hit = await rscHit("限流");

    expect(hit?.snippet).not.toBeNull();
    expect(hit?.snippet?.text).toContain("限流");

    const snippet = hit?.snippet;

    if (snippet === null || snippet === undefined) {
      return;
    }

    expect(snippet.matches.length).toBeGreaterThan(0);

    for (const match of snippet.matches) {
      expect(
        snippet.text.slice(match.start, match.start + match.length)
      ).toHaveLength(match.length);
    }

    expect(
      snippet.matches.some((match) =>
        snippet.text
          .slice(match.start, match.start + match.length)
          .includes("限流")
      )
    ).toBeTruthy();
  });

  it("does not repeat a hit the title or summary already shows", async () => {
    await expect(rscHit("状态层")).resolves.toMatchObject({ snippet: null });
    await expect(rscHit("银弹")).resolves.toMatchObject({ snippet: null });
  });

  it("keeps a Latin word whole at the snippet boundary", async () => {
    const hit = await rscHit("supercalifragilistic");

    expect(hit?.snippet?.text).toContain("supercalifragilisticexpialidocious");
  });

  it("returns the body as plain text, so markup in it stays text", async () => {
    const hit = await rscHit("<b>&");
    const text = hit?.snippet?.text ?? "";

    expect(text).toContain("<b>&");
    expect(text).not.toContain("<mark");
  });

  it("indexes published, non-draft posts only", async () => {
    const { documentCount } = await createSearchIndex(db);

    // rsc, oklch and existence are published; the draft post is not.
    expect(documentCount).toBe(3);
  });

  it("strips Markdown from the indexed body before building a snippet", async () => {
    const slug = "h60-plain-snippet";

    await db.insert(posts).values({
      bodyMd: [
        "## 标题",
        "",
        "**粗体** [链接](https://example.com) ![图](a.png)",
        "",
        "| 列 | 值 |",
        "| --- | --- |",
        "| 一 | 二 |",
        "",
        "---",
        "",
        "唯一词H60 与 `code`。",
      ].join("\n"),
      published: true,
      slug,
      title: "纯文本片段探针",
    });

    try {
      const result = await client.search.query({ q: "唯一词H60" });
      const hit = result.items.find((item) => item.slug === slug);
      const text = hit?.snippet?.text ?? "";

      expect(hit?.snippet).not.toBeNull();
      expect(text).toContain("唯一词H60");

      for (const forbidden of [
        "](",
        "|",
        "**",
        "__",
        "---",
        String.fromCodePoint(96),
      ]) {
        expect(text).not.toContain(forbidden);
      }

      expect(text).not.toMatch(/^#/u);
    } finally {
      await db.delete(posts).where(eq(posts.slug, slug));
    }
  });
});
