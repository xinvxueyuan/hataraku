import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import type { CoverMeta } from "@hataraku/db/schema/json";
import { posts } from "@hataraku/db/schema/posts";
import { categories, postTags, tags } from "@hataraku/db/schema/taxonomy";

import { paginate } from "#src/pagination.ts";
import { publicProcedure } from "#src/procedures.ts";
import { adminPostsRouter } from "#src/routers/admin-posts.ts";
import {
  adjacentPostsSchema,
  listPostsInput,
  paginatedSchema,
  postDetailSchema,
  slugInput,
  postSummarySchema,
  relatedPostsInput,
} from "#src/schemas.ts";

/**
 * List projection. Body markdown is left out so a list response never carries every article's
 * full text, and the tag array is aggregated in the same round trip.
 */
const summarySelect = {
  categorySlug: posts.categorySlug,
  cover: posts.cover,
  coverKey: posts.coverKey,
  description: posts.description,
  featured: posts.featured,
  id: posts.id,
  publishedAt: posts.publishedAt,
  readingMinutes: posts.readingMinutes,
  slug: posts.slug,
  tags: sql<string[] | null>`(
    select coalesce(array_agg(t.slug order by t.slug), '{}'::text[])
      from ${postTags} pt
      join ${tags} t on t.id = pt.tag_id
     where pt.post_id = "posts"."id"
  )`.as("tags"),
  title: posts.title,
  updatedAt: posts.updatedAt,
};

interface SummaryRow {
  categorySlug: string | null;
  cover: CoverMeta | null;
  coverKey: string | null;
  description: string | null;
  featured: boolean;
  id: string;
  publishedAt: Date | null;
  readingMinutes: number | null;
  slug: string;
  tags: string[] | null;
  title: string;
  updatedAt: Date | null;
}

/** The aggregate is null when a post has no tags; the contract says an array. */
const mapSummary = (row: SummaryRow) => ({ ...row, tags: row.tags ?? [] });

/** Published, non-draft only. Drafts are not part of the public read path. */
const visible = sql`${posts.published} = true and ${posts.draft} = false`;

export const postsRouter = {
  ...adminPostsRouter,

  /** Adjacent posts by publish date, for the article footer. */
  adjacent: publicProcedure
    .input(slugInput)
    .output(adjacentPostsSchema)
    .handler(async ({ context, input }) => {
      const [anchor] = await context.db
        .select({ publishedAt: posts.publishedAt })
        .from(posts)
        .where(and(visible, eq(posts.slug, input.slug)))
        .limit(1);

      if (!anchor?.publishedAt) {
        return { next: null, previous: null };
      }

      const [previous, next] = await Promise.all([
        context.db
          .select(summarySelect)
          .from(posts)
          .where(and(visible, lt(posts.publishedAt, anchor.publishedAt)))
          .orderBy(desc(posts.publishedAt))
          .limit(1),
        context.db
          .select(summarySelect)
          .from(posts)
          .where(and(visible, gt(posts.publishedAt, anchor.publishedAt)))
          .orderBy(asc(posts.publishedAt))
          .limit(1),
      ]);

      return {
        next: next[0] ? mapSummary(next[0]) : null,
        previous: previous[0] ? mapSummary(previous[0]) : null,
      };
    }),

  bySlug: publicProcedure
    .input(slugInput)
    .output(postDetailSchema)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({
          ...summarySelect,
          bodyMd: posts.bodyMd,
          categoryAccent: categories.accent,
          categoryName: categories.name,
          comment: posts.comment,
          views: posts.views,
        })
        .from(posts)
        .leftJoin(categories, eq(categories.id, posts.categoryId))
        .where(and(visible, eq(posts.slug, input.slug)))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      const { categoryAccent, categoryName, ...summary } = row;

      return {
        ...mapSummary(summary),
        bodyMd: row.bodyMd,
        category:
          row.categorySlug !== null && categoryName !== null
            ? {
                accent: categoryAccent ?? null,
                name: categoryName,
                slug: row.categorySlug,
              }
            : null,
        comment: row.comment,
        views: row.views,
      };
    }),

  list: publicProcedure
    .input(listPostsInput)
    .output(paginatedSchema(postSummarySchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [visible];

      if (input.categorySlug !== undefined) {
        filters.push(eq(posts.categorySlug, input.categorySlug));
      }

      if (input.featuredOnly === true) {
        filters.push(eq(posts.featured, true));
      }

      if (input.tagSlugs !== undefined) {
        // A subquery rather than a join: joining would duplicate a post per matching tag.
        // `inArray` is what binds the slug list as a parameter; interpolating the array into raw
        // SQL sends it as a bare string and PostgreSQL rejects the array literal.
        filters.push(
          inArray(
            posts.id,
            context.db
              .select({ postId: postTags.postId })
              .from(postTags)
              .innerJoin(tags, eq(tags.id, postTags.tagId))
              .where(inArray(tags.slug, input.tagSlugs))
          )
        );
      }

      const where = and(...filters);

      const column = {
        publishedAt: posts.publishedAt,
        title: posts.title,
        updatedAt: posts.updatedAt,
        views: posts.views,
      }[input.orderBy ?? "publishedAt"];

      const order =
        (input.direction ?? (input.orderBy === "title" ? "asc" : "desc")) ===
        "asc"
          ? asc(column)
          : desc(column);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select(summarySelect)
          .from(posts)
          .where(where)
          .orderBy(order, desc(posts.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(posts)
          .where(where),
      ]);

      return paginate(rows.map(mapSummary), totalRow[0]?.total ?? 0, input);
    }),

  /** Related by shared tag, else same category, newest first. */
  related: publicProcedure
    .input(relatedPostsInput)
    .output(z.array(postSummarySchema))
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select(summarySelect)
        .from(posts)
        .where(
          and(
            visible,
            sql`${posts.slug} <> ${input.slug}`,
            or(
              sql`exists (
                select 1 from ${postTags} pt1
                  join ${postTags} pt2 on pt2.tag_id = pt1.tag_id
                  join ${posts} p2 on p2.id = pt2.post_id
                 where pt1.post_id = "posts"."id" and p2.slug = ${input.slug}
              )`,
              sql`${posts.categorySlug} is not null and ${posts.categorySlug} = (
                select p3.category_slug from ${posts} p3 where p3.slug = ${input.slug} limit 1
              )`
            )
          )
        )
        .orderBy(desc(posts.publishedAt))
        .limit(input.limit);

      return rows.map(mapSummary);
    }),
};
