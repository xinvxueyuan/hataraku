import { and, asc, desc, eq, sql } from "drizzle-orm";

import { posts } from "@hataraku/db/schema/posts";
import { categories, postTags, tags } from "@hataraku/db/schema/taxonomy";

import type { Context } from "#src/context.ts";
import { publicRoute } from "#src/openapi-public.ts";
import { publicProcedure } from "#src/procedures.ts";
import {
  categoryWithCountSchema,
  listTagsInput,
  tagWithCountSchema,
  taxonomyOverviewSchema,
} from "#src/schemas.ts";

/**
 * A tag's count is the number of published, non-draft posts carrying it — the same visibility rule
 * the post list applies, so the cloud never advertises a tag whose only post is a draft.
 *
 * The outer table must be named explicitly ("tags"."id") and posts must go through the `p` alias:
 * an unqualified `"id"` inside the subquery would bind to the subquery's own FROM.
 */
const tagPostCount = sql<number>`(
  select count(*)::int
    from ${postTags} pt
    join ${posts} p on p.id = pt.post_id
   where pt.tag_id = "tags"."id" and p.published = true and p.draft = false
)`.as("post_count");

const categoryPostCount = sql<number>`(
  select count(*)::int from ${posts} p
   where p.category_slug = "categories"."slug" and p.published = true and p.draft = false
)`.as("post_count");

const listTags = async (
  db: Context["db"],
  options: { minCount: number; orderBy: "count" | "name" }
) => {
  const rows = await db
    .select({
      accent: tags.accent,
      description: tags.description,
      id: tags.id,
      name: tags.name,
      postCount: tagPostCount,
      slug: tags.slug,
    })
    .from(tags)
    .orderBy(
      options.orderBy === "name" ? asc(tags.slug) : desc(tagPostCount),
      asc(tags.slug)
    );

  return rows
    .map((row) => ({ ...row, postCount: row.postCount }))
    .filter((row) => row.postCount >= options.minCount);
};

const listCategories = async (db: Context["db"]) => {
  const rows = await db
    .select({
      accent: categories.accent,
      description: categories.description,
      id: categories.id,
      name: categories.name,
      postCount: categoryPostCount,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.slug));

  return rows.map((row) => ({ ...row, postCount: row.postCount }));
};

export const taxonomyRouter = {
  categories: publicProcedure
    .route(publicRoute("taxonomy.categories"))
    .output(categoryWithCountSchema.array())
    .handler(async ({ context }) => await listCategories(context.db)),

  /**
   * `minCount` defaults to 1 so a tag cloud only shows tags a reader can actually open;
   * the taxonomy index passes 0 to show every tag, including ones whose posts are all drafts.
   */
  overview: publicProcedure
    .route(publicRoute("taxonomy.overview"))
    .output(taxonomyOverviewSchema)
    .handler(async ({ context }) => {
      const [tagRows, categoryRows, totalRow] = await Promise.all([
        listTags(context.db, { minCount: 0, orderBy: "count" }),
        listCategories(context.db),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(posts)
          .where(and(eq(posts.published, true), eq(posts.draft, false))),
      ]);

      return {
        categories: categoryRows,
        tags: tagRows,
        totalPosts: totalRow[0]?.total ?? 0,
      };
    }),

  tags: publicProcedure
    .route(publicRoute("taxonomy.tags"))
    .input(listTagsInput)
    .output(tagWithCountSchema.array())
    .handler(async ({ context, input }) => await listTags(context.db, input)),
};
