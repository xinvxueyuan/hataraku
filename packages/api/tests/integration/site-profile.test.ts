import { describe, expect, it } from "vite-plus/test";

import { createClient, signUp } from "../support/api.ts";

type ProfileInput = Parameters<
  ReturnType<typeof createClient>["site"]["updateProfile"]
>[0];

/** A complete profile, so a case only has to override the field it is about. */
const fullProfile: ProfileInput = {
  author: "xinvStar",
  avatarUrl: "",
  description: "夜行栈：把代码、学习与生活编排成一片可阅读的个人星图。",
  email: "owner@example.com",
  hero: {
    badge: "夜行栈",
    cta: "开始阅读",
    ctaHref: "/archive",
    description: "一片可阅读的个人星图。",
    meta: "已更新 48 篇",
    title: "夜行栈",
  },
  name: "夜行栈",
  nameEn: "NightStack",
  social: { github: "https://github.com/xinvstar", twitter: "" },
  tagline: "昼 · 清醒记录构建 / 夜 · 沉浸漫游沉思",
};

const clearedProfile: ProfileInput = {
  author: "",
  avatarUrl: "",
  description: "",
  email: "",
  hero: {
    badge: "",
    cta: "",
    ctaHref: "",
    description: "",
    meta: "",
    title: "",
  },
  name: "只留名字",
  nameEn: "",
  social: {},
  tagline: "",
};

describe("site.updateProfile", () => {
  it("refuses anonymous callers", async () => {
    const anonymous = createClient();

    await expect(
      anonymous.site.updateProfile(fullProfile)
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("refuses an account off the write allowlist", async () => {
    const reader = await signUp({
      adminEmails: "owner@example.com",
      email: "reader@example.com",
    });

    await expect(reader.site.updateProfile(fullProfile)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("writes the profile and reads it back through the public procedure", async () => {
    const owner = await signUp();

    await owner.site.updateProfile(fullProfile);

    const profile = await createClient().site.profile();

    expect(profile).toMatchObject({
      author: fullProfile.author,
      description: fullProfile.description,
      email: fullProfile.email,
      hero: fullProfile.hero,
      id: 1,
      name: fullProfile.name,
      nameEn: fullProfile.nameEn,
      tagline: fullProfile.tagline,
    });
    // The empty social link is not stored as an empty string.
    expect(profile.social).toStrictEqual({
      github: "https://github.com/xinvstar",
    });
  });

  it("clears every optional field with an empty box", async () => {
    const owner = await signUp();

    await owner.site.updateProfile(fullProfile);
    await owner.site.updateProfile(clearedProfile);

    const profile = await createClient().site.profile();

    expect(profile).toMatchObject({
      author: null,
      avatarUrl: null,
      description: null,
      email: null,
      hero: null,
      id: 1,
      name: clearedProfile.name,
      nameEn: null,
      social: null,
      tagline: null,
    });
  });

  it.each<[string, ProfileInput]>([
    [
      "an empty name",
      {
        ...fullProfile,
        name: "   ",
      },
    ],
    [
      "a non-http avatar URL",
      {
        ...fullProfile,
        avatarUrl: "ftp://example.com/avatar.png",
      },
    ],
    [
      "a malformed email",
      {
        ...fullProfile,
        email: "not-an-email",
      },
    ],
    [
      "a non-http social link",
      {
        ...fullProfile,
        social: { github: "ftp://example.com/xinvstar" },
      },
    ],
    [
      "a protocol-relative hero link",
      {
        ...fullProfile,
        hero: { ...fullProfile.hero, ctaHref: "//evil.example.com" },
      },
    ],
  ])("rejects %s", async (_case, input) => {
    const owner = await signUp();

    await expect(owner.site.updateProfile(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
