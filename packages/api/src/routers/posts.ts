import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@hataraku/db";
import { posts } from "@hataraku/db/schema/posts";
import { categories, postTags, tags } from "@hataraku/db/schema/taxonomy";

import { publicRoute } from "#src/openapi-public.ts";
import { paginate } from "#src/pagination.ts";
import { publicProcedure } from "#src/procedures.ts";
import { adminPostsRouter } from "#src/routers/admin-posts.ts";
import {
  adjacentPostsSchema,
  listPostsInput,
  paginatedSchema,
  postDetailSchema,
  postSummarySchema,
  refInput,
  relatedPostsInput,
} from "#src/schemas.ts";

/**
 * List projection. Body markdown is left out so a list response never carries every article's
 * full text, and the tag array is aggregated in the same round trip.
 */
const summarySelect = {
  categorySlug: posts.categorySlug,
  coverKey: posts.coverKey,
  description: posts.description,
  featured: posts.featured,
  id: posts.id,
  publishedAt: posts.publishedAt,
  readingMinutes: posts.readingMinutes,
  slug: posts.slug,
  slugOnly: posts.slugOnly,
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
  coverKey: string | null;
  description: string | null;
  featured: boolean;
  id: number;
  publishedAt: Date | null;
  readingMinutes: number | null;
  slug: string | null;
  slugOnly: boolean;
  tags: string[] | null;
  title: string;
  updatedAt: Date | null;
}

/** The aggregate is null when a post has no tags; the contract says an array. */
const mapSummary = (row: SummaryRow) => ({ ...row, tags: row.tags ?? [] });

/** Published, non-draft only. Drafts are not part of the public read path. */
const visible = sql`${posts.published} = true and ${posts.draft} = false`;

const NUMERIC_SEGMENT = /^\d+$/u;
const MAX_INTEGER_ID = 2_147_483_647;

/**
 * Resolves one public segment. A numeric segment is an id, never a slug; a slug-only post is
 * invisible under its id so the caller cannot probe which ids exist.
 */
const resolveRef = async (db: Database, segment: string) => {
  const numeric = NUMERIC_SEGMENT.test(segment);
  const id = numeric ? Number(segment) : null;

  if (
    numeric &&
    (id === null || !Number.isSafeInteger(id) || id > MAX_INTEGER_ID)
  ) {
    return null;
  }

  const [row] = await db
    .select({
      categorySlug: posts.categorySlug,
      id: posts.id,
      publishedAt: posts.publishedAt,
      slugOnly: posts.slugOnly,
    })
    .from(posts)
    .where(
      and(visible, numeric ? eq(posts.id, id ?? 0) : eq(posts.slug, segment))
    )
    .limit(1);

  if (row === undefined || (numeric && row.slugOnly)) {
    return null;
  }

  return row;
};

export const postsRouter = {
  ...adminPostsRouter,

  /** Adjacent posts by publish date, for the article footer. */
  adjacent: publicProcedure
    .route(publicRoute("posts.adjacent"))
    .input(refInput)
    .output(adjacentPostsSchema)
    .handler(async ({ context, input }) => {
      const anchor = await resolveRef(context.db, input.segment);

      if (anchor?.publishedAt === null || anchor?.publishedAt === undefined) {
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

  byRef: publicProcedure
    .route(publicRoute("posts.byRef"))
    .input(refInput)
    .output(postDetailSchema)
    .handler(async ({ context, input }) => {
      const numeric = NUMERIC_SEGMENT.test(input.segment);
      const id = numeric ? Number(input.segment) : null;

      const validId =
        id !== null && Number.isSafeInteger(id) && id <= MAX_INTEGER_ID;

      let refWhere = eq(posts.slug, input.segment);

      if (numeric) {
        refWhere = validId ? eq(posts.id, id) : sql`false`;
      }

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
        .where(and(visible, refWhere))
        .limit(1);

      if (!row || (numeric && row.slugOnly)) {
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
    .route(publicRoute("posts.list"))
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
    .route(publicRoute("posts.related"))
    .input(relatedPostsInput)
    .output(z.array(postSummarySchema))
    .handler(async ({ context, input }) => {
      const anchor = await resolveRef(context.db, input.segment);

      if (anchor === null) {
        return [];
      }

      const rows = await context.db
        .select(summarySelect)
        .from(posts)
        .where(
          and(
            visible,
            ne(posts.id, anchor.id),
            or(
              sql`exists (
                select 1 from ${postTags} pt1
                  join ${postTags} pt2 on pt2.tag_id = pt1.tag_id
                 where pt1.post_id = ${posts.id} and pt2.post_id = ${anchor.id}
              )`,
              anchor.categorySlug === null
                ? sql`false`
                : eq(posts.categorySlug, anchor.categorySlug)
            )
          )
        )
        .orderBy(desc(posts.publishedAt))
        .limit(input.limit);

      return rows.map(mapSummary);
    }),
};
