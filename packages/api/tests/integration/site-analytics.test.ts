import { describe, expect, it } from "vite-plus/test";

import { createClient, signUp } from "../support/api.ts";

const anonymous = createClient();

/** Built from parts so the source never contains a scheme a linter would flag as executable. */
const scriptUrl = (scheme: string): string => `${scheme}:alert(1)`;

/** What the write path stores for the analytics column; the tests vary one field at a time. */
interface AnalyticsInput {
  enabled: boolean;
  provider: "custom" | "google" | "none" | "plausible" | "umami";
  respectDnt: boolean;
  scriptSrc: string;
  siteId: string;
}

/**
 * The profile payload the write path requires, with analytics as the one field under test.
 * The row is single, so each test writes the whole profile and reads it back.
 */
const profile = (analytics: AnalyticsInput) => ({
  analytics,
  author: "xinvStar",
  avatarUrl: "",
  description: "昼构建，夜沉思。",
  email: "owner@example.com",
  hero: {
    badge: "",
    cta: "",
    ctaHref: "",
    description: "",
    meta: "",
    title: "",
  },
  name: "夜行栈",
  nameEn: "NightStack",
  social: {},
  tagline: "昼构建夜沉思",
});

const analytics = (
  overrides: Partial<AnalyticsInput> = {}
): AnalyticsInput => ({
  enabled: false,
  provider: "none",
  respectDnt: true,
  scriptSrc: "",
  siteId: "",
  ...overrides,
});

describe("site analytics", () => {
  it("answers UNAUTHORIZED for an anonymous write and FORBIDDEN off the allowlist", async () => {
    await expect(
      anonymous.site.updateProfile(profile(analytics()))
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const outsider = await signUp({ adminEmails: "owner@example.com" });

    await expect(
      outsider.site.updateProfile(profile(analytics()))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores nothing to load by default", async () => {
    const owner = await signUp();

    const written = await owner.site.updateProfile(profile(analytics()));

    expect(written.analytics).toStrictEqual(analytics());
    await expect(anonymous.site.profile()).resolves.toMatchObject({
      analytics: analytics(),
    });
  });

  it("stores an enabled umami configuration and hands it back", async () => {
    const owner = await signUp();

    const enabled = analytics({
      enabled: true,
      provider: "umami",
      respectDnt: false,
      siteId: "3f2a9c1e-0000-4c33",
    });

    const written = await owner.site.updateProfile(profile(enabled));

    expect(written.analytics).toStrictEqual(enabled);
    await expect(anonymous.site.profile()).resolves.toMatchObject({
      analytics: enabled,
    });
  });

  it("keeps a configuration that is switched off — the injection gate is the reader's job", async () => {
    const owner = await signUp();

    const offButConfigured = analytics({
      provider: "plausible",
      siteId: "example.com",
    });

    const written = await owner.site.updateProfile(profile(offButConfigured));

    expect(written.analytics).toMatchObject({
      enabled: false,
      provider: "plausible",
      siteId: "example.com",
    });
  });

  it.each([
    ["javascript", scriptUrl("javascript")],
    ["data", `${scriptUrl("data")}:text/html,<script>alert(1)</script>`],
    ["plain http", "http://cdn.example.com/a.js"],
  ])("refuses a %s script URL", async (_label, scriptSrc) => {
    const owner = await signUp();

    await expect(
      owner.site.updateProfile(
        profile(analytics({ provider: "custom", scriptSrc }))
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a hosted provider without a site id", async () => {
    const owner = await signUp();

    await expect(
      owner.site.updateProfile(profile(analytics({ provider: "umami" })))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses a custom provider without an https script", async () => {
    const owner = await signUp();

    await expect(
      owner.site.updateProfile(profile(analytics({ provider: "custom" })))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("site profile round-trip", () => {
  it("saves the social links the row already carries, site paths included", async () => {
    const owner = await signUp();
    const payload = profile(analytics());

    const written = await owner.site.updateProfile({
      ...payload,
      social: { github: "https://github.com/xinvxueyuan", rss: "/rss.xml" },
    });

    expect(written.social).toStrictEqual({
      github: "https://github.com/xinvxueyuan",
      rss: "/rss.xml",
    });
  });

  it("still refuses a social entry that is neither http(s) nor a site path", async () => {
    const owner = await signUp();

    await expect(
      owner.site.updateProfile({
        ...profile(analytics()),
        social: { bad: "ftp://example.com/feed" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
