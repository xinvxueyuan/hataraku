import { describe, expect, it } from "vite-plus/test";

import { albums } from "@hataraku/db/schema/media";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("media.albums", () => {
  it("lists albums newest first", async () => {
    const page = await client.media.albums.list({});

    expect(page.items.map((album) => album.slug)).toStrictEqual([
      "japan",
      "city",
    ]);
    expect(page.total).toBe(2);
  });

  it("filters by tag using array containment", async () => {
    const page = await client.media.albums.list({ tag: "travel" });

    expect(page.items.map((album) => album.slug)).toStrictEqual(["japan"]);
  });

  it("returns an album with its photos in order", async () => {
    const album = await client.media.albums.byRef({ segment: "japan" });

    expect(album.photoCount).toBe(2);
    expect(album.photos.map((photo) => photo.imageKey)).toStrictEqual([
      "albums/japan/1.webp",
      "albums/japan/2.webp",
    ]);
    expect(album.coverKey).toBe("albums/japan/cover.webp");
  });

  it("resolves an album by numeric id", async () => {
    const page = await client.media.albums.list({});
    const id = page.items.find((album) => album.slug === "japan")?.id;

    expect(id).toBeDefined();
    await expect(
      client.media.albums.byRef({ segment: String(id) })
    ).resolves.toMatchObject({ id, slug: "japan" });
  });

  it("answers NOT_FOUND for an unknown album", async () => {
    await expect(
      client.media.albums.byRef({ segment: "missing" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("hides a slug-only album from its numeric id", async () => {
    const [album] = await db
      .insert(albums)
      .values({
        published: true,
        slug: "slug-only-album",
        slugOnly: true,
        title: "Only",
      })
      .returning();

    expect(album).toBeDefined();
    await expect(
      client.media.albums.byRef({ segment: String(album?.id) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.media.albums.byRef({ segment: "slug-only-album" })
    ).resolves.toMatchObject({ id: album?.id, slugOnly: true });
  });

  it("rejects a page size above the cap", async () => {
    await expect(
      client.media.albums.list({ pageSize: 101 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("media.devices", () => {
  it("lists devices and filters by category", async () => {
    const all = await client.media.devices.list({});
    expect(all.items.map((device) => device.slug)).toStrictEqual([
      "macbook",
      "pixel",
    ]);

    const phones = await client.media.devices.list({ category: "phone" });
    expect(phones.items.map((device) => device.slug)).toStrictEqual(["pixel"]);
  });
});

describe("media.diary", () => {
  it("lists entries newest first", async () => {
    const page = await client.media.diary.list({});

    expect(page.items.map((entry) => entry.slug)).toStrictEqual([
      "diary-1",
      "diary-2",
    ]);
  });

  it("filters by date range", async () => {
    const page = await client.media.diary.list({
      from: "2026-06-21",
      to: "2026-06-30",
    });

    expect(page.items.map((entry) => entry.slug)).toStrictEqual(["diary-1"]);
  });

  it("filters by tag", async () => {
    const page = await client.media.diary.list({ tag: "life" });

    expect(page.items.map((entry) => entry.slug)).toStrictEqual(["diary-2"]);
  });

  it("rejects a malformed date with BAD_REQUEST", async () => {
    await expect(
      client.media.diary.list({ from: "not-a-date" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("media.timeline", () => {
  it("lists entries newest first and filters by category", async () => {
    const all = await client.media.timeline.list({});
    expect(all.items.map((entry) => entry.slug)).toStrictEqual(["v1", "moved"]);

    const life = await client.media.timeline.list({ category: "life" });
    expect(life.items.map((entry) => entry.slug)).toStrictEqual(["moved"]);
  });
});
