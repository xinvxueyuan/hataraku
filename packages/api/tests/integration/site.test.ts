import { sql } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";

import { createClient, db } from "../support/api.ts";
import { seedBlog } from "../support/fixtures.ts";

const client = createClient();

await seedBlog(db);

describe("site.profile", () => {
  it("returns the single profile row with its navigation and social links", async () => {
    const profile = await client.site.profile();

    expect(profile).toMatchObject({
      author: "xinvStar",
      id: 1,
      name: "夜行栈",
      nameEn: "NightStack",
      nav: { cta: { href: "/article", label: "进入栈内" } },
      social: { github: "https://github.com/xinvxueyuan", rss: "/rss.xml" },
      tagline: "昼构建夜沉思",
    });
    expect(profile.updatedAt).toBeInstanceOf(Date);
  });

  it("answers NOT_FOUND when the row is missing", async () => {
    await db.execute(sql`delete from site_profile`);

    await expect(client.site.profile()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
