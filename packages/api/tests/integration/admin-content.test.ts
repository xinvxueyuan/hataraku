import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createClient, signUp } from "../support/api.ts";

const anonymous = createClient();

const R2_ENV = {
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_ACCOUNT_ID: "0123456789abcdef",
  R2_BUCKET: "hataraku-test",
  R2_PUBLIC_BASE_URL: "https://media.example.test",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
} as const;

const micro = () => ({
  content: `测试瞬间 ${crypto.randomUUID().slice(0, 8)}`,
  published: false,
});

const project = () => ({
  bodyMd: "## 细节\n\n一段说明。\n",
  description: "一个项目",
  published: true,
  title: `Project ${crypto.randomUUID().slice(0, 8)}`,
});

const entry = () => ({
  bodyMd: "### 修复\n\n- 修好了\n",
  releasedAt: "2026-10-20",
  version: `2.${Math.floor(Math.random() * 1000)}.0`,
});

describe("content write path", () => {
  it.each([
    ["micro.create", async () => await anonymous.content.micro.create(micro())],
    [
      "projects.create",
      async () => await anonymous.content.projects.create(project()),
    ],
    [
      "changelog.create",
      async () => await anonymous.content.changelog.create(entry()),
    ],
    ["uploads.policy", async () => await anonymous.media.uploads.policy()],
    [
      "uploads.presign",
      async () =>
        await anonymous.media.uploads.presign({
          contentType: "image/png",
          prefix: "projects",
          size: 1024,
        }),
    ],
    [
      "micro.adminList",
      async () => await anonymous.content.micro.adminList({}),
    ],
  ])("rejects an anonymous %s with UNAUTHORIZED", async (_, call) => {
    await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses an account outside ADMIN_EMAILS with FORBIDDEN", async () => {
    const client = await signUp({ adminEmails: "owner@example.com" });

    await expect(client.content.micro.create(micro())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("keeps a draft micro post off the public list until it is published", async () => {
    const owner = await signUp();
    const draft = micro();
    const created = await owner.content.micro.create(draft);

    expect(created).toMatchObject({ content: draft.content, published: false });
    expect(created.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

    const publicBefore = await anonymous.content.micro.list({
      page: 1,
      pageSize: 50,
    });

    expect(publicBefore.items.map((row) => row.id)).not.toContain(created.id);

    await owner.content.micro.publish({ id: created.id });

    const publicAfter = await anonymous.content.micro.list({
      page: 1,
      pageSize: 50,
    });

    expect(publicAfter.items.map((row) => row.id)).toContain(created.id);
    expect(
      publicAfter.items.find((row) => row.id === created.id)?.publishedAt
    ).toBeInstanceOf(Date);
  });

  it("derives a dated slug when the note has no ASCII to keep", async () => {
    const owner = await signUp();

    const created = await owner.content.micro.create({
      content: "夜跑笔记",
      published: false,
    });

    expect(created.slug).toMatch(/^micro-\d{8}-[a-z0-9]{4}$/u);
  });

  it("stores an edit and hands the new text back", async () => {
    const owner = await signUp();
    const created = await owner.content.micro.create(micro());

    await expect(
      owner.content.micro.update({ content: "改过的内容", id: created.id })
    ).resolves.toMatchObject({ content: "改过的内容" });
    await expect(
      owner.content.micro.remove({ id: created.id })
    ).resolves.toMatchObject({ id: created.id });
    await expect(
      owner.content.micro.remove({ id: created.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists a published project on the public read path", async () => {
    const owner = await signUp();
    const input = project();
    const created = await owner.content.projects.create(input);

    expect(created).toMatchObject({ published: true, title: input.title });

    const listed = await anonymous.content.projects.list({
      page: 1,
      pageSize: 50,
    });

    expect(listed.items.map((row) => row.id)).toContain(created.id);
    await expect(
      anonymous.content.projects.bySlug({ slug: created.slug })
    ).resolves.toMatchObject({ bodyMd: input.bodyMd });
  });

  it("refuses an unsafe project body with a readable BAD_REQUEST", async () => {
    const owner = await signUp();

    await expect(
      owner.content.projects.create({
        ...project(),
        bodyMd: "{process.env.SECRET}",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.content.projects.create({
        ...project(),
        bodyMd: "<script>alert(1)</script>",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a project slug that is already taken", async () => {
    const owner = await signUp();
    const created = await owner.content.projects.create(project());

    await expect(
      owner.content.projects.create({ ...project(), slug: created.slug })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates a changelog entry from its version and updates the highlight", async () => {
    const owner = await signUp();
    const input = entry();
    const created = await owner.content.changelog.create(input);

    expect(created).toMatchObject({
      releasedAt: input.releasedAt,
      version: input.version,
    });
    expect(created.slug).toMatch(/^2-\d+-0$/u);

    await expect(
      owner.content.changelog.update({ highlight: true, id: created.id })
    ).resolves.toMatchObject({ highlight: true });

    const highlighted = await anonymous.content.changelog.list({
      highlightOnly: true,
      page: 1,
      pageSize: 50,
    });

    expect(highlighted.items.map((row) => row.id)).toContain(created.id);
  });

  it("reports the upload policy to an admin", async () => {
    const owner = await signUp();
    const policy = await owner.media.uploads.policy();

    expect(policy.allowedMimeTypes).toContain("image/webp");
    expect(policy.prefixes).toContain("projects");
    expect(policy.maxBytes).toBe(10 * 1024 * 1024);
  });
});

describe("uploads.presign", () => {
  const saved = { ...process.env };

  beforeAll(() => {
    for (const [name, value] of Object.entries(R2_ENV)) {
      process.env[name] = value;
    }
  });

  afterAll(() => {
    // An empty value reads as "not configured" in the uploader, so this restores the previous state
    // without deleting a computed key from the environment object.
    for (const name of Object.keys(R2_ENV)) {
      process.env[name] = "";
    }

    Object.assign(process.env, saved);
  });

  it("signs a PUT for the planned key without touching the network", async () => {
    const owner = await signUp();

    const ticket = await owner.media.uploads.presign({
      contentType: "image/webp",
      prefix: "projects",
      scope: "night-runner",
      size: 4096,
    });

    expect(ticket.key).toMatch(
      /^projects\/night-runner\/\d{14}-[a-z0-9]{8}\.webp$/u
    );
    expect(ticket.publicUrl).toBe(`${R2_ENV.R2_PUBLIC_BASE_URL}/${ticket.key}`);
    expect(ticket.contentType).toBe("image/webp");
  });

  it("addresses the bucket, the key and a short expiry in the signed URL", async () => {
    const owner = await signUp();

    const ticket = await owner.media.uploads.presign({
      contentType: "image/png",
      prefix: "projects",
      size: 4096,
    });

    const url = new URL(ticket.uploadUrl);

    expect(url.hostname).toBe(
      `${R2_ENV.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    );
    expect(url.pathname).toContain(ticket.key);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
  });

  it("refuses a type that is not an image", async () => {
    const owner = await signUp();

    await expect(
      owner.media.uploads.presign({
        contentType: "image/svg+xml",
        prefix: "projects",
        size: 4096,
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("refuses a file over the size cap", async () => {
    const owner = await signUp();

    await expect(
      owner.media.uploads.presign({
        contentType: "image/png",
        prefix: "projects",
        size: 11 * 1024 * 1024,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("uploads.presign without storage configured", () => {
  it("answers SERVICE_UNAVAILABLE instead of a broken signature", async () => {
    for (const name of Object.keys(R2_ENV)) {
      process.env[name] = "";
    }

    const owner = await signUp();

    await expect(
      owner.media.uploads.presign({
        contentType: "image/png",
        prefix: "projects",
        size: 1024,
      })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});

/** A token unique to one test, so a search only matches rows that test created. */
const listToken = () => `cq-${crypto.randomUUID().slice(0, 8)}`;

describe("content admin list query", () => {
  it("filters micro posts by kind and by visibility", async () => {
    const owner = await signUp();
    const mark = listToken();

    const note = await owner.content.micro.create({
      content: `${mark} text`,
      published: true,
      type: "text",
    });

    const snippet = await owner.content.micro.create({
      content: `${mark} code`,
      published: false,
      type: "code",
    });

    const codes = await owner.content.micro.adminList({
      pageSize: 50,
      query: mark,
      type: "code",
    });

    expect(codes.items.map((row) => row.id)).toStrictEqual([snippet.id]);

    const drafts = await owner.content.micro.adminList({
      pageSize: 50,
      published: false,
      query: mark,
    });

    expect(drafts.items.map((row) => row.id)).toStrictEqual([snippet.id]);

    const published = await owner.content.micro.adminList({
      pageSize: 50,
      published: true,
      query: mark,
    });

    expect(published.items.map((row) => row.id)).toStrictEqual([note.id]);
  });

  it("filters projects by state and by visibility", async () => {
    const owner = await signUp();
    const mark = listToken();

    const active = await owner.content.projects.create({
      ...project(),
      status: "active",
      title: `${mark} active`,
    });

    const archived = await owner.content.projects.create({
      ...project(),
      published: false,
      status: "archived",
      title: `${mark} archived`,
    });

    const archivedPage = await owner.content.projects.adminList({
      pageSize: 50,
      query: mark,
      status: "archived",
    });

    expect(archivedPage.items.map((row) => row.id)).toStrictEqual([
      archived.id,
    ]);

    const publishedPage = await owner.content.projects.adminList({
      pageSize: 50,
      published: true,
      query: mark,
    });

    expect(publishedPage.items.map((row) => row.id)).toStrictEqual([active.id]);
  });

  it("filters changelog entries to highlighted releases and searches versions", async () => {
    const owner = await signUp();
    const mark = listToken();

    const plain = await owner.content.changelog.create({
      ...entry(),
      title: `${mark} plain`,
    });

    const highlighted = await owner.content.changelog.create({
      ...entry(),
      highlight: true,
      title: `${mark} highlighted`,
    });

    const highlightedPage = await owner.content.changelog.adminList({
      highlight: true,
      pageSize: 50,
      query: mark,
    });

    expect(highlightedPage.items.map((row) => row.id)).toStrictEqual([
      highlighted.id,
    ]);

    const all = await owner.content.changelog.adminList({
      pageSize: 50,
      query: mark,
    });

    expect(all.items.map((row) => row.id).toSorted()).toStrictEqual(
      [plain.id, highlighted.id].toSorted()
    );
  });

  it("rejects an out-of-range page on every content list", async () => {
    const owner = await signUp();

    await expect(
      owner.content.micro.adminList({ page: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.content.projects.adminList({ pageSize: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      owner.content.changelog.adminList({ pageSize: 500 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
