import { ORPCError } from "@orpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@hataraku/db";
import { posts } from "@hataraku/db/schema/posts";
import type { NewPost, Post } from "@hataraku/db/schema/posts";

import { assertSafeMdx, UnsafeMdxError } from "#src/mdx-guard.ts";
import { adminProcedure } from "#src/procedures.ts";
import {
  adminPostDetailSchema,
  adminPostSummarySchema,
  createPostInput,
  postIdInput,
  updatePostInput,
} from "#src/schemas.ts";

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

const toAdminSummary = (row: Post) => ({
  id: row.id,
  publishedAt: row.publishedAt,
  slug: row.slug,
  status: statusOf(row),
  title: row.title,
  updatedAt: row.updatedAt,
});

const toAdminDetail = (row: Post) => ({
  ...toAdminSummary(row),
  bodyMd: row.bodyMd ?? "",
  description: row.description,
});

const findPost = async (db: Database, id: string): Promise<Post> => {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Post not found" });
  }

  return row;
};

/**
 * Rejects a body the renderer would refuse, at the moment the author can still fix it.
 *
 * `assertSafeMdx` is the same rule `renderMdx` applies when it reads a body back; this is the write
 * side of that boundary, not a second policy.
 */
const guardBody = (bodyMd: string): void => {
  try {
    assertSafeMdx(bodyMd);
  } catch (error) {
    if (error instanceof UnsafeMdxError) {
      throw new ORPCError("BAD_REQUEST", {
        data: { reason: error.reason },
        message: `This body cannot be saved: ${error.reason}.`,
      });
    }

    throw error;
  }
};

/** A readable conflict beats a raw unique-index violation. The index stays the invariant. */
const assertSlugFree = async (
  db: Database,
  slug: string,
  exceptId: string | null
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
 * The write path for posts: the admin editor's procedures.
 *
 * Every procedure is an `adminProcedure`, so the session and the `ADMIN_EMAILS` allowlist are
 * checked before a handler runs, and every body passes `assertSafeMdx` before it is stored.
 * These are spread into `postsRouter`, so callers still see one `posts` namespace.
 */
export const adminPostsRouter = {
  /** Every post, drafts included, newest edit first. The read path never sees drafts. */
  adminList: adminProcedure
    .output(z.array(adminPostSummarySchema))
    .handler(async ({ context }) => {
      const rows = await context.db
        .select()
        .from(posts)
        .orderBy(desc(posts.updatedAt), desc(posts.createdAt));

      return rows.map(toAdminSummary);
    }),

  /** The editor's read: one row by id, body included, drafts included. */
  byId: adminProcedure
    .input(postIdInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      const row = await findPost(context.db, input.id);

      return toAdminDetail(row);
    }),

  create: adminProcedure
    .input(createPostInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      guardBody(input.bodyMd);
      await assertSlugFree(context.db, input.slug, null);

      const [row] = await context.db
        .insert(posts)
        .values({
          bodyMd: input.bodyMd,
          description: input.description,
          slug: input.slug,
          title: input.title,
          updatedAt: new Date(),
          ...statusFields(input.status, null),
        })
        .returning();

      if (row === undefined) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The post was not stored.",
        });
      }

      return toAdminDetail(row);
    }),

  /** Publishing is its own action, so the index can toggle it without loading the body. */
  publish: adminProcedure
    .input(postIdInput)
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

  remove: adminProcedure
    .input(postIdInput)
    .output(adminPostSummarySchema)
    .handler(async ({ context, input }) => {
      await findPost(context.db, input.id);

      const [row] = await context.db
        .delete(posts)
        .where(eq(posts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      return toAdminSummary(row);
    }),

  unpublish: adminProcedure
    .input(postIdInput)
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

  update: adminProcedure
    .input(updatePostInput)
    .output(adminPostDetailSchema)
    .handler(async ({ context, input }) => {
      const { id, status, ...changes } = input;

      const existing = await findPost(context.db, id);

      if (changes.bodyMd !== undefined) {
        guardBody(changes.bodyMd);
      }

      if (changes.slug !== undefined) {
        await assertSlugFree(context.db, changes.slug, id);
      }

      const stored: Partial<NewPost> = { ...changes, updatedAt: new Date() };

      if (status !== undefined) {
        Object.assign(stored, statusFields(status, existing.publishedAt));
      }

      const [row] = await context.db
        .update(posts)
        .set(stored)
        .where(eq(posts.id, id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Post not found" });
      }

      return toAdminDetail(row);
    }),
};
