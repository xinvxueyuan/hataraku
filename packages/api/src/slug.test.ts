import { describe, expect, it } from "vite-plus/test";

import { resolveSlug, slugify } from "#src/slug.ts";

const at = new Date("2026-10-21T02:03:04.000Z");

describe(slugify, () => {
  it.each([
    ["Night Runner", "night-runner"],
    ["  spaced   out  ", "spaced-out"],
    ["Hello, World!", "hello-world"],
    ["Café Notes", "cafe-notes"],
    ["v2.0 release", "v2-0-release"],
  ])("turns %j into %j", (input, expected) => {
    expect(slugify(input, "item", at)).toBe(expected);
  });

  it("falls back to a dated suffix when the text has no ASCII to keep", () => {
    expect(slugify("夜跑笔记", "micro", at)).toMatch(
      /^micro-20261021-[a-z0-9]{4}$/u
    );
  });

  it("keeps a slug at 80 characters or fewer", () => {
    expect(slugify("a".repeat(200), "item", at)).toHaveLength(80);
  });
});

describe(resolveSlug, () => {
  it("uses the explicit slug and collapses it like any other", () => {
    expect(resolveSlug(" My Post ", "ignored", "projects")).toBe("my-post");
  });

  it("falls back to the source field when the explicit slug is blank", () => {
    expect(resolveSlug("   ", "Night Runner", "projects")).toBe("night-runner");
    expect(resolveSlug(null, "夜跑", "micro", at)).toMatch(/^micro-20261021-/u);
  });
});
