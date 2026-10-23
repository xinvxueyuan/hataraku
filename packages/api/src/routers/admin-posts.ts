import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@hataraku/db";
import { posts } from "@hataraku/db/schema/posts";
import type { NewPost, Post } from "@hataraku/db/schema/posts";
import { categories, postTags, tags } from "@hataraku/db/schema/taxonomy";

import { assertStorableBody } from "#src/mdx-guard.ts";
import { writeRoute } from "#src/openapi-public.ts";
import { paginate } from "#src/pagination.ts";
import { adminProcedure, writeProcedure } from "#src/procedures.ts";
import {
  adminPostDetailSchema,
  adminPostStatsSchema,
  adminPostSummarySchema,
  adminPostsListInput,
  createPostInput,
  paginatedSchema,
  postIdInput,
  updatePostInput,
} from "#src/schemas.ts";

/** Path ids arrive as strings over HTTP; RPC callers pass numbers. Normalize both at the write edge. */
const writePostIdInput = z.object({ id: z.coerce.number().int() });

const writeUpdatePostInput = z
  .object({ ...updatePostInput.shape, id: z.coerce.number().int() })
  .superRefine((value, context) => {
    if (value.slugOnly === true && value.slug === null) {
      context.addIssue({
        code: "custom",
        message: "slugOnly requires a slug",
        path: ["slug"],
      });
    }
  });

/** The three tables the write path touches. A transaction handle answers the same subset. */
type Writer = Pick<Database, "delete" | "insert" | "select" | "update">;

/**
 * The stored row carries `draft` and `published` booleans (the schema was migrated from the previous
 * stack) while the editor speaks one `status`. This is the only place the two are mapped.
 */
const statusOf = (row: Post): "draft" | "published" =>
  row.published && !row.draft ? "published" : "draft";

/**
 * The stored columns for a status. Publishing keeps the original date, so a republished article does
 * not jump to the top of the index; a first publish stamps now.
 */
const statusFields = (
  status: "draft" | "published",
  publishedAt: Date | null
) => ({
  draft: status !== "published",
  published: status === "published",
  publishedAt:
    status === "published" ? (publishedAt ?? new Date()) : publishedAt,
});

/** The stored instant for a day the form sent; `null` stays `null`. */
const dayAtMidnight = (value: string | null): Date | null =>
  value === null ? null : new Date(`${value}T00:00:00.000Z`);

const toAdminSummary = (row: Post) => ({
  id: row.id,
  publishedAt: row.publishedAt,
  slug: row.slug,
  slugOnly: row.slugOnly,
  status: statusOf(row),
  title: row.title,
  updatedAt: row.updatedAt,
});

const toAdminDetail = (row: Post, tagSlugs: string[]) => ({
  ...toAdminSummary(row),
  bodyMd: row.bodyMd ?? "",
  categorySlug: row.categorySlug,
  coverKey: row.coverKey,
  description: row.description,
  featured: row.featured,
  tagSlugs,
});

const findPost = async (db: Database, id: number): Promise<Post> => {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Post not found" });
  }

  return row;
};

/** A readable conflict beats a raw unique-index violation. The index stays the invariant. */
const assertSlugFree = async (
  db: Database,
  slug: string,
  exceptId: number | null
): Promise<void> => {
  const [taken] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      exceptId === null
        ? eq(posts.slug, slug)
        : and(eq(posts.slug, slug), ne(posts.id, exceptId))
    )
    .limit(1);

  if (taken !== undefined) {
    throw new ORPCError("CONFLICT", {
      message: `The slug "${slug}" is already taken.`,
    });
  }
};

/**
 * Resolves a category by slug, creating it when the author named a new one.
 *
 * Categories have no other writer in this stack: the taxonomy tables arrived with the migrated rows
 * and nothing else could add to them, so filing a new article under a new category has to start here.
 * A category's display name defaults to its slug; the form may send a nicer one.
 */
const ensureCategory = async (
  db: Writer,
  slug: string,
  name: string | undefined
): Promise<{ id: string; slug: string }> => {
  await db
    .insert(categories)
    .values({ name: name ?? slug, slug })
    .onConflictDoNothing({ target: categories.slug });

  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (row === undefined) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "The category could not be resolved.",
    });
  }

  return { id: row.id, slug };
};

/** Tags are upserted by slug: an author typing a new tag gets it created instead of an error. */
const ensureTagIds = async (db: Writer, slugs: string[]): Promise<string[]> => {
  if (slugs.length === 0) {
    return [];
  }

  await db
    .insert(tags)
    .values(slugs.map((slug) => ({ name: slug, slug })))
    .onConflictDoNothing({ target: tags.slug });

  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.slug, slugs));

  return rows.map((row) => row.id);
};

const tagSlugsOf = async (db: Writer, postId: number): Promise<string[]> => {
  const rows = await db
    .select({ slug: tags.slug })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId));

  return rows.map((row) => row.slug).toSorted();
};

/** Duplicates and blanks in the typed list collapse before anything is written. */
const normalizeTagSlugs = (slugs: string[]): string[] =>
  [
    ...new Set(
      slugs.flatMap((slug) => {
        const value = slug.trim();

        return value.length > 0 ? [value] : [];
      })
    ),
  ].toSorted();

/**
 * Applies only the difference between the stored links and the requested ones.
 *
 * Rebuilding the whole set would delete and re-insert every row on each save. The diff keeps the
 * write proportional to what actually changed, and the returned slugs are what the post now carries.
 */
const syncPostTags = async (
  db: Writer,
  postId: number,
  slugs: string[]
): Promise<string[]> => {
  const desired = normalizeTagSlugs(slugs);
  const desiredIds = await ensureTagIds(db, desired);

  const current = await db
    .select({ tagId: postTags.tagId })
    .from(postTags)
    .where(eq(postTags.postId, postId));

  const currentIds = new Set(current.map((row) => row.tagId));
  const nextIds = new Set(desiredIds);
  const added = desiredIds.filter((id) => !currentIds.has(id));
  const removed = [...currentIds].filter((id) => !nextIds.has(id));

  if (removed.length > 0) {
    await db
      .delete(postTags)
      .where(
        and(eq(postTags.postId, postId), inArray(postTags.tagId, removed))
      );
  }

  if (added.length > 0) {
    await db
      .insert(postTags)
      .values(added.map((tagId) => ({ postId, tagId })))
      .onConflictDoNothing();
  }

  return desired;
};

/**
 * The write path for posts: the admin editor's procedures.
 *
 * Every procedure is an `adminProcedure`, so the session and the `ADMIN_EMAILS` allowlist are
 * checked before a handler runs, and every body passes `assertSafeMdx` before it is stored.
 * These are spread into `postsRouter`, so callers still see one `posts` namespace.
 */
export const adminPostsRouter = {
  /**
   * Every post, drafts included: search, filter, sort and a page at a time.
   *
   * PostgreSQL does the matching and the slicing, so a search covers the whole table rather than the
   * page the browser happens to hold.
   */
  adminList: adminProcedure
    .input(adminPostsListInput)
    .output(paginatedSchema(adminPostSummarySchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [];

      if (input.query !== undefined) {
        const needle = `%${input.query}%`;

        filters.push(
          or(
            ilike(posts.title, needle),
            ilike(posts.slug, needle),
            ilike(posts.bodyMd, needle)
          ) ?? sql`false`
        );
      }

      if (input.status === "published") {
        filters.push(
          and(eq(posts.published, true), eq(posts.draft, false)) ?? sql`false`
        );
      } else if (input.status === "draft") {
        filters.push(
          or(eq(posts.draft, true), eq(posts.published, false)) ?? sql`false`
        );
      }

      const where = filters.length === 0 ? undefined : and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(posts)
          .where(where)
          .orderBy(
            ...(input.sort === "published"
              ? [desc(posts.publishedAt), desc(posts.createdAt)]
              : [desc(posts.updatedAt), desc(posts.createdAt)])
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(posts)
          .where(where),
      ]);

      return paginate(rows.map(toAdminSummary), totalRow[0]?.total ?? 0, input);
    }),

  /** The counts the admin index shows, from one query so the three numbers agree. */
  adminStats: adminProcedure
    .output(adminPostStatsSchema)
    .handler(async ({ context }) => {
      const [row] = await context.db
        .select({
          drafts: sql<number>`(count(*) filter (where ${posts.draft} = true or ${posts.published} = false))::int`,
          published: sql<number>`(count(*) filter (where ${posts.draft} = false and ${posts.published} = true))::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(posts);

      return row ?? { drafts: 0, published: 0, total: 0 };
    }),

  /** The editor's read: one row by id, body and taxonomy included, drafts included. */
  byId: adminProcedure
    .input(postIdInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      const row = await findPost(context.db, input.id);
      const slugs = await tagSlugsOf(context.db, input.id);

      return toAdminDetail(row, slugs);
    }),

  create: writeProcedure("posts:write")
    .route(writeRoute("posts.create"))
    .input(createPostInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      assertStorableBody(input.bodyMd);

      if (input.slug !== null) {
        await assertSlugFree(context.db, input.slug, null);
      }

      const { row, slugs } = await context.db.transaction(async (tx) => {
        const values: NewPost = {
          bodyMd: input.bodyMd,
          coverKey: input.coverKey,
          description: input.description,
          featured: input.featured,
          slug: input.slug,
          slugOnly: input.slugOnly,
          title: input.title,
          updatedAt: new Date(),
          ...statusFields(input.status, dayAtMidnight(input.publishedAt)),
        };

        if (input.categorySlug !== null) {
          const category = await ensureCategory(
            tx,
            input.categorySlug,
            input.categoryName
          );

          values.categoryId = category.id;
          values.categorySlug = category.slug;
        }

        const [created] = await tx.insert(posts).values(values).returning();

        if (created === undefined) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "The post was not stored.",
          });
        }

        return {
          row: created,
          slugs: await syncPostTags(tx, created.id, input.tagSlugs),
        };
      });

      return toAdminDetail(row, slugs);
    }),

  /** Publishing is its own action, so the index can toggle it without loading the body. */
  publish: writeProcedure("posts:write")
    .route(writeRoute("posts.publish"))
    .input(writePostIdInput)
    .output(adminPostSummarySchema)
    .handler(async ({ context, input }) => {
      const existing = await findPost(context.db, input.id);

      const [row] = await context.db
        .update(posts)
        .set({
          ...statusFields("published", existing.publishedAt),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      return toAdminSummary(row);
    }),

  /**
   * Deleting the post also deletes its tag links: `post_tags` carries no foreign key (the migrated
   * schema only has the composite key), so an unhandled delete leaves rows pointing at nothing.
   */
  remove: adminProcedure
    .input(postIdInput)
    .output(adminPostSummarySchema)
    .handler(async ({ context, input }) => {
      await findPost(context.db, input.id);

      const row = await context.db.transaction(async (tx) => {
        await tx.delete(postTags).where(eq(postTags.postId, input.id));

        const [deleted] = await tx
          .delete(posts)
          .where(eq(posts.id, input.id))
          .returning();

        return deleted;
      });

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      return toAdminSummary(row);
    }),

  unpublish: writeProcedure("posts:write")
    .route(writeRoute("posts.unpublish"))
    .input(writePostIdInput)
    .output(adminPostSummarySchema)
    .handler(async ({ context, input }) => {
      const existing = await findPost(context.db, input.id);

      const [row] = await context.db
        .update(posts)
        .set({
          ...statusFields("draft", existing.publishedAt),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      return toAdminSummary(row);
    }),

  update: writeProcedure("posts:write")
    .route(writeRoute("posts.update"))
    .input(writeUpdatePostInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      const {
        categoryName,
        categorySlug,
        coverKey,
        featured,
        id,
        publishedAt,
        slugOnly,
        status,
        tagSlugs,
        ...changes
      } = input;

      const existing = await findPost(context.db, id);

      const effectiveSlug =
        changes.slug === undefined ? existing.slug : changes.slug;

      const effectiveSlugOnly = slugOnly ?? existing.slugOnly;

      if (effectiveSlugOnly && effectiveSlug === null) {
        throw new ORPCError("BAD_REQUEST", {
          message: "slugOnly requires a slug",
        });
      }

      if (changes.bodyMd !== undefined) {
        assertStorableBody(changes.bodyMd);
      }

      if (changes.slug !== undefined && changes.slug !== null) {
        await assertSlugFree(context.db, changes.slug, id);
      }

      const { row, slugs } = await context.db.transaction(async (tx) => {
        const stored: Partial<NewPost> = { ...changes, updatedAt: new Date() };

        if (featured !== undefined) {
          stored.featured = featured;
        }

        if (coverKey !== undefined) {
          stored.coverKey = coverKey;
        }

        if (slugOnly !== undefined) {
          stored.slugOnly = slugOnly;
        }

        if (status !== undefined) {
          Object.assign(stored, statusFields(status, existing.publishedAt));
        }

        // An explicit day wins over the stamp a status change would have written.
        if (publishedAt !== undefined) {
          stored.publishedAt = dayAtMidnight(publishedAt);
        }

        if (categorySlug === null) {
          stored.categoryId = null;
          stored.categorySlug = null;
        } else if (categorySlug !== undefined) {
          const category = await ensureCategory(tx, categorySlug, categoryName);

          stored.categoryId = category.id;
          stored.categorySlug = category.slug;
        }

        const [updated] = await tx
          .update(posts)
          .set(stored)
          .where(eq(posts.id, id))
          .returning();

        if (updated === undefined) {
          throw new ORPCError("NOT_FOUND", { message: "Post not found" });
        }

        return {
          row: updated,
          slugs:
            tagSlugs === undefined
              ? await tagSlugsOf(tx, id)
              : await syncPostTags(tx, id, tagSlugs),
        };
      });

      return toAdminDetail(row, slugs);
    }),
};
