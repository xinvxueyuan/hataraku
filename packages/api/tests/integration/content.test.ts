import { describe, expect, it } from "vite-plus/test";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("content.projects", () => {
  it("lists projects by sortOrder and excludes unpublished rows", async () => {
    const page = await client.content.projects.list({});

    expect(page.items.map((project) => project.slug)).toStrictEqual([
      "flow-field",
      "murmur",
    ]);
    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({
      featured: true,
      status: "active",
      tags: ["p5.js", "Canvas"],
      title: "Flow Field Studio",
    });
  });

  it("filters by status", async () => {
    const page = await client.content.projects.list({ status: "archived" });

    expect(page.items.map((project) => project.slug)).toStrictEqual(["murmur"]);
  });

  it("filters by featured", async () => {
    const page = await client.content.projects.list({ featuredOnly: true });

    expect(page.items.map((project) => project.slug)).toStrictEqual([
      "flow-field",
    ]);
  });

  it("pages with a limit and offset", async () => {
    const second = await client.content.projects.list({ page: 2, pageSize: 1 });

    expect(second.items.map((project) => project.slug)).toStrictEqual([
      "murmur",
    ]);
    expect(second).toMatchObject({ total: 2, totalPages: 2 });
  });

  it("returns a project by slug and NOT_FOUND otherwise", async () => {
    await expect(
      client.content.projects.bySlug({ slug: "flow-field" })
    ).resolves.toMatchObject({
      slug: "flow-field",
    });
    await expect(
      client.content.projects.bySlug({ slug: "missing" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("content.micro", () => {
  it("lists published entries newest first and keeps the music payload", async () => {
    const page = await client.content.micro.list({});

    expect(page.items.map((entry) => entry.slug)).toStrictEqual([
      "micro-text",
      "micro-music",
    ]);
    expect(page.items[1]?.music).toStrictEqual({
      artist: "Nujabes",
      track: "Luv(sic) Part 3",
    });
  });

  it("filters by type", async () => {
    const page = await client.content.micro.list({ type: "music" });

    expect(page.items.map((entry) => entry.slug)).toStrictEqual([
      "micro-music",
    ]);
  });
});

describe("content.changelog", () => {
  it("lists releases newest first", async () => {
    const page = await client.content.changelog.list({});

    expect(page.items.map((entry) => entry.version)).toStrictEqual([
      "v3.0",
      "v2.0",
    ]);
    expect(page.items[0]).toMatchObject({
      changes: ["迁移到 Next.js", "斜切 Hero"],
      highlight: true,
      releasedAt: "2026-07-18",
    });
  });

  it("filters to highlighted releases", async () => {
    const page = await client.content.changelog.list({ highlightOnly: true });

    expect(page.items.map((entry) => entry.version)).toStrictEqual(["v3.0"]);
  });
});

describe("content.tools", () => {
  it("lists tools by sortOrder", async () => {
    const page = await client.content.tools.list({});

    expect(page.items.map((tool) => tool.slug)).toStrictEqual([
      "vscode",
      "figma",
    ]);
  });

  it("filters by category", async () => {
    const page = await client.content.tools.list({ category: "design" });

    expect(page.items.map((tool) => tool.slug)).toStrictEqual(["figma"]);
  });
});

describe("content.friends", () => {
  it("returns the whole published link list by sortOrder", async () => {
    const friends = await client.content.friends.list();

    expect(friends.map((friend) => friend.slug)).toStrictEqual([
      "zhangsan",
      "lisi",
    ]);
  });
});

describe("content.skills", () => {
  it("returns skills ordered by category then sortOrder", async () => {
    const skills = await client.content.skills.list();

    expect(skills.map((skill) => skill.slug)).toStrictEqual([
      "postgresql",
      "typescript",
    ]);
    expect(skills[1]).toMatchObject({ category: "frontend", level: 90 });
  });
});
