import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Database } from "@hataraku/db";
import {
  changelogEntries,
  friends,
  microPosts,
  projects,
  skills,
  tools,
} from "@hataraku/db/schema/content";
import type {
  ChangelogEntry,
  MicroPost,
  NewChangelogEntry,
  NewMicroPost,
  NewProject,
  Project,
} from "@hataraku/db/schema/content";

import { assertStorableBody } from "#src/mdx-guard.ts";
import { paginate } from "#src/pagination.ts";
import { adminProcedure, publicProcedure } from "#src/procedures.ts";
import {
  adminChangelogListInput,
  adminMicroListInput,
  adminProjectsListInput,
  changelogEntryIdInput,
  changelogEntrySchema,
  createChangelogEntryInput,
  createMicroPostInput,
  createProjectInput,
  friendSchema,
  listChangelogInput,
  listMicroInput,
  listProjectsInput,
  listToolsInput,
  microPostIdInput,
  microPostSchema,
  paginatedSchema,
  projectIdInput,
  projectSchema,
  skillSchema,
  slugInput,
  toolSchema,
  updateChangelogEntryInput,
  updateMicroPostInput,
  updateProjectInput,
} from "#src/schemas.ts";
import { resolveSlug } from "#src/slug.ts";

/* -------------------------------------------------------------------------- */
/* Shared write-path helpers                                                   */
/* -------------------------------------------------------------------------- */

/** The stored instant for the day a form sent; `null` stays `null`. */
const dayAtMidnight = (value: string | null): Date | null =>
  value === null ? null : new Date(`${value}T00:00:00.000Z`);

/** A readable conflict beats a raw unique-index violation. The index stays the invariant. */
const assertSlugFree = (taken: boolean): void => {
  if (taken) {
    throw new ORPCError("CONFLICT", {
      message: "That slug is already taken.",
    });
  }
};

const microSlugTaken = async (
  db: Database,
  slug: string,
  exceptId: string | null
): Promise<boolean> => {
  const rows = await db
    .select({ id: microPosts.id })
    .from(microPosts)
    .where(
      exceptId === null
        ? eq(microPosts.slug, slug)
        : and(eq(microPosts.slug, slug), ne(microPosts.id, exceptId))
    )
    .limit(1);

  return rows.length > 0;
};

const projectSlugTaken = async (
  db: Database,
  slug: string,
  exceptId: string | null
): Promise<boolean> => {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      exceptId === null
        ? eq(projects.slug, slug)
        : and(eq(projects.slug, slug), ne(projects.id, exceptId))
    )
    .limit(1);

  return rows.length > 0;
};

const changelogSlugTaken = async (
  db: Database,
  slug: string,
  exceptId: string | null
): Promise<boolean> => {
  const rows = await db
    .select({ id: changelogEntries.id })
    .from(changelogEntries)
    .where(
      exceptId === null
        ? eq(changelogEntries.slug, slug)
        : and(
            eq(changelogEntries.slug, slug),
            ne(changelogEntries.id, exceptId)
          )
    )
    .limit(1);

  return rows.length > 0;
};

const findMicroPost = async (db: Database, id: string): Promise<MicroPost> => {
  const [row] = await db
    .select()
    .from(microPosts)
    .where(eq(microPosts.id, id))
    .limit(1);

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Micro post not found" });
  }

  return row;
};

const findProject = async (db: Database, id: string): Promise<Project> => {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Project not found" });
  }

  return row;
};

const findChangelogEntry = async (
  db: Database,
  id: string
): Promise<ChangelogEntry> => {
  const [row] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, id))
    .limit(1);

  if (row === undefined) {
    throw new ORPCError("NOT_FOUND", { message: "Changelog entry not found" });
  }

  return row;
};

/* -------------------------------------------------------------------------- */
/* Routers                                                                     */
/* -------------------------------------------------------------------------- */

const projectsRouter = {
  /**
   * Every project, drafts included: search, filter, sort and a page at a time.
   *
   * The search term is matched by PostgreSQL, not by the browser: the list is paged, so filtering in
   * the client would only ever search the page it already has.
   */
  adminList: adminProcedure
    .input(adminProjectsListInput)
    .output(paginatedSchema(projectSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [];

      if (input.query !== undefined) {
        const needle = `%${input.query}%`;

        filters.push(
          or(
            ilike(projects.title, needle),
            ilike(projects.slug, needle),
            ilike(projects.description, needle),
            ilike(projects.bodyMd, needle)
          ) ?? sql`false`
        );
      }

      if (input.status !== undefined) {
        filters.push(eq(projects.status, input.status));
      }

      if (input.published !== undefined) {
        filters.push(eq(projects.published, input.published));
      }

      const where = filters.length === 0 ? undefined : and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(projects)
          .where(where)
          .orderBy(
            ...(input.sort === "published"
              ? [desc(projects.publishedAt), desc(projects.updatedAt)]
              : [desc(projects.updatedAt)])
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(projects)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),

  /** The editor's read: one project by id, body included, drafts included. */
  byId: adminProcedure
    .input(projectIdInput)
    .output(projectSchema)
    .handler(
      async ({ context, input }) => await findProject(context.db, input.id)
    ),

  bySlug: publicProcedure
    .input(slugInput)
    .output(projectSchema)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select()
        .from(projects)
        .where(and(eq(projects.published, true), eq(projects.slug, input.slug)))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      return row;
    }),

  create: adminProcedure
    .input(createProjectInput)
    .output(projectSchema)
    .handler(async ({ context, input }) => {
      assertStorableBody(input.bodyMd);

      const slug = resolveSlug(input.slug, input.title, "project");

      assertSlugFree(await projectSlugTaken(context.db, slug, null));

      const [row] = await context.db
        .insert(projects)
        .values({
          bodyMd: input.bodyMd,
          coverKey: input.coverKey,
          description: input.description,
          featured: input.featured,
          link: input.link,
          published: input.published,
          publishedAt: dayAtMidnight(input.publishedAt) ?? new Date(),
          repo: input.repo,
          slug,
          sortOrder: input.sortOrder,
          status: input.status,
          tags: input.tags,
          title: input.title,
          updatedAt: new Date(),
        })
        .returning();

      if (row === undefined) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The project was not stored.",
        });
      }

      return row;
    }),

  list: publicProcedure
    .input(listProjectsInput)
    .output(paginatedSchema(projectSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [eq(projects.published, true)];

      if (input.status !== undefined) {
        filters.push(eq(projects.status, input.status));
      }

      if (input.featuredOnly === true) {
        filters.push(eq(projects.featured, true));
      }

      const where = and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(projects)
          .where(where)
          .orderBy(asc(projects.sortOrder), desc(projects.publishedAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(projects)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),

  remove: adminProcedure
    .input(projectIdInput)
    .output(projectSchema)
    .handler(async ({ context, input }) => {
      await findProject(context.db, input.id);

      const [row] = await context.db
        .delete(projects)
        .where(eq(projects.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      return row;
    }),

  update: adminProcedure
    .input(updateProjectInput)
    .output(projectSchema)
    .handler(async ({ context, input }) => {
      const { id, publishedAt, slug, ...changes } = input;

      const existing = await findProject(context.db, id);

      if (changes.bodyMd !== undefined) {
        assertStorableBody(changes.bodyMd);
      }

      const stored: Partial<NewProject> = { ...changes, updatedAt: new Date() };

      if (publishedAt !== undefined) {
        stored.publishedAt = dayAtMidnight(publishedAt);
      }

      if (slug !== undefined) {
        const next = resolveSlug(
          slug,
          changes.title ?? existing.title,
          "project"
        );

        assertSlugFree(await projectSlugTaken(context.db, next, id));
        stored.slug = next;
      }

      const [row] = await context.db
        .update(projects)
        .set(stored)
        .where(eq(projects.id, id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      return row;
    }),
};

const microRouter = {
  /** Every micro post, drafts included, one page of search/filter/sort results at a time. */
  adminList: adminProcedure
    .input(adminMicroListInput)
    .output(paginatedSchema(microPostSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [];

      if (input.query !== undefined) {
        const needle = `%${input.query}%`;

        filters.push(
          or(
            ilike(microPosts.content, needle),
            ilike(microPosts.slug, needle)
          ) ?? sql`false`
        );
      }

      if (input.type !== undefined) {
        filters.push(eq(microPosts.type, input.type));
      }

      if (input.published !== undefined) {
        filters.push(eq(microPosts.published, input.published));
      }

      const where = filters.length === 0 ? undefined : and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(microPosts)
          .where(where)
          .orderBy(
            ...(input.sort === "created"
              ? [desc(microPosts.createdAt)]
              : [desc(microPosts.publishedAt), desc(microPosts.createdAt)])
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(microPosts)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),

  /** The editor's read: one micro post by id, drafts included. */
  byId: adminProcedure
    .input(microPostIdInput)
    .output(microPostSchema)
    .handler(
      async ({ context, input }) => await findMicroPost(context.db, input.id)
    ),

  create: adminProcedure
    .input(createMicroPostInput)
    .output(microPostSchema)
    .handler(async ({ context, input }) => {
      // `content` is plain text, not MDX: the renderer escapes it, so there is no body to guard.
      const slug = resolveSlug(input.slug, input.content, "micro");

      assertSlugFree(await microSlugTaken(context.db, slug, null));

      const [row] = await context.db
        .insert(microPosts)
        .values({
          content: input.content,
          imageKeys: input.imageKeys,
          published: input.published,
          publishedAt:
            dayAtMidnight(input.publishedAt) ??
            (input.published ? new Date() : null),
          slug,
          tags: input.tags,
          type: input.type,
        })
        .returning();

      if (row === undefined) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The micro post was not stored.",
        });
      }

      return row;
    }),

  list: publicProcedure
    .input(listMicroInput)
    .output(paginatedSchema(microPostSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [eq(microPosts.published, true)];

      if (input.type !== undefined) {
        filters.push(eq(microPosts.type, input.type));
      }

      const where = and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(microPosts)
          .where(where)
          .orderBy(desc(microPosts.publishedAt), desc(microPosts.id))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(microPosts)
          .where(where),
      ]);

      return paginate(rows, totalRow?.[0]?.total ?? 0, input);
    }),

  /** Publishing keeps the original moment, so a re-published note does not jump to the top. */
  publish: adminProcedure
    .input(microPostIdInput)
    .output(microPostSchema)
    .handler(async ({ context, input }) => {
      const existing = await findMicroPost(context.db, input.id);

      const [row] = await context.db
        .update(microPosts)
        .set({
          published: true,
          publishedAt: existing.publishedAt ?? new Date(),
        })
        .where(eq(microPosts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Micro post not found" });
      }

      return row;
    }),

  remove: adminProcedure
    .input(microPostIdInput)
    .output(microPostSchema)
    .handler(async ({ context, input }) => {
      await findMicroPost(context.db, input.id);

      const [row] = await context.db
        .delete(microPosts)
        .where(eq(microPosts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Micro post not found" });
      }

      return row;
    }),

  unpublish: adminProcedure
    .input(microPostIdInput)
    .output(microPostSchema)
    .handler(async ({ context, input }) => {
      await findMicroPost(context.db, input.id);

      const [row] = await context.db
        .update(microPosts)
        .set({ published: false })
        .where(eq(microPosts.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Micro post not found" });
      }

      return row;
    }),

  update: adminProcedure
    .input(updateMicroPostInput)
    .output(microPostSchema)
    .handler(async ({ context, input }) => {
      const { id, publishedAt, slug, ...changes } = input;

      const existing = await findMicroPost(context.db, id);

      const stored: Partial<NewMicroPost> = { ...changes };

      if (publishedAt !== undefined) {
        stored.publishedAt = dayAtMidnight(publishedAt);
      }

      if (slug !== undefined) {
        const next = resolveSlug(
          slug,
          changes.content ?? existing.content,
          "micro"
        );

        assertSlugFree(await microSlugTaken(context.db, next, id));
        stored.slug = next;
      }

      const [row] = await context.db
        .update(microPosts)
        .set(stored)
        .where(eq(microPosts.id, id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", { message: "Micro post not found" });
      }

      return row;
    }),
};

const changelogRouter = {
  /** Every entry, highlights and plain releases alike, one page at a time. */
  adminList: adminProcedure
    .input(adminChangelogListInput)
    .output(paginatedSchema(changelogEntrySchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [];

      if (input.query !== undefined) {
        const needle = `%${input.query}%`;

        filters.push(
          or(
            ilike(changelogEntries.version, needle),
            ilike(changelogEntries.slug, needle),
            ilike(changelogEntries.title, needle),
            ilike(changelogEntries.bodyMd, needle)
          ) ?? sql`false`
        );
      }

      if (input.highlight !== undefined) {
        filters.push(eq(changelogEntries.highlight, input.highlight));
      }

      const where = filters.length === 0 ? undefined : and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(changelogEntries)
          .where(where)
          .orderBy(
            ...(input.sort === "created"
              ? [desc(changelogEntries.createdAt)]
              : [
                  desc(changelogEntries.releasedAt),
                  desc(changelogEntries.createdAt),
                ])
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(changelogEntries)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),

  /** The editor's read: one entry by id, body included. */
  byId: adminProcedure
    .input(changelogEntryIdInput)
    .output(changelogEntrySchema)
    .handler(
      async ({ context, input }) =>
        await findChangelogEntry(context.db, input.id)
    ),

  create: adminProcedure
    .input(createChangelogEntryInput)
    .output(changelogEntrySchema)
    .handler(async ({ context, input }) => {
      assertStorableBody(input.bodyMd);

      // The version is the natural fallback: `v1.2.0` becomes `v1-2-0`.
      const slug = resolveSlug(input.slug, input.version, "changelog");

      assertSlugFree(await changelogSlugTaken(context.db, slug, null));

      const [row] = await context.db
        .insert(changelogEntries)
        .values({
          bodyMd: input.bodyMd,
          changes: input.changes,
          highlight: input.highlight,
          releasedAt: input.releasedAt,
          slug,
          title: input.title,
          version: input.version,
        })
        .returning();

      if (row === undefined) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The changelog entry was not stored.",
        });
      }

      return row;
    }),

  list: publicProcedure
    .input(listChangelogInput)
    .output(paginatedSchema(changelogEntrySchema))
    .handler(async ({ context, input }) => {
      const where =
        input.highlightOnly === true
          ? eq(changelogEntries.highlight, true)
          : undefined;

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(changelogEntries)
          .where(where)
          .orderBy(
            desc(changelogEntries.releasedAt),
            asc(changelogEntries.version)
          )
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(changelogEntries)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),

  remove: adminProcedure
    .input(changelogEntryIdInput)
    .output(changelogEntrySchema)
    .handler(async ({ context, input }) => {
      await findChangelogEntry(context.db, input.id);

      const [row] = await context.db
        .delete(changelogEntries)
        .where(eq(changelogEntries.id, input.id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", {
          message: "Changelog entry not found",
        });
      }

      return row;
    }),

  update: adminProcedure
    .input(updateChangelogEntryInput)
    .output(changelogEntrySchema)
    .handler(async ({ context, input }) => {
      const { id, slug, ...changes } = input;

      const existing = await findChangelogEntry(context.db, id);

      if (changes.bodyMd !== undefined) {
        assertStorableBody(changes.bodyMd);
      }

      const stored: Partial<NewChangelogEntry> = { ...changes };

      if (slug !== undefined) {
        const next = resolveSlug(
          slug,
          changes.version ?? existing.version,
          "changelog"
        );

        assertSlugFree(await changelogSlugTaken(context.db, next, id));
        stored.slug = next;
      }

      const [row] = await context.db
        .update(changelogEntries)
        .set(stored)
        .where(eq(changelogEntries.id, id))
        .returning();

      if (row === undefined) {
        throw new ORPCError("NOT_FOUND", {
          message: "Changelog entry not found",
        });
      }

      return row;
    }),
};

const toolsRouter = {
  list: publicProcedure
    .input(listToolsInput)
    .output(paginatedSchema(toolSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [eq(tools.published, true)];

      if (input.category !== undefined) {
        filters.push(eq(tools.category, input.category));
      }

      if (input.featuredOnly === true) {
        filters.push(eq(tools.featured, true));
      }

      const where = and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(tools)
          .where(where)
          .orderBy(asc(tools.sortOrder), asc(tools.name))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(tools)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),
};

export const contentRouter = {
  changelog: changelogRouter,
  friends: {
    /** A link list is short by nature, so it is returned whole rather than paged. */
    list: publicProcedure
      .output(friendSchema.array())
      .handler(({ context }) =>
        context.db
          .select()
          .from(friends)
          .where(eq(friends.published, true))
          .orderBy(asc(friends.sortOrder), asc(friends.name))
      ),
  },
  micro: microRouter,
  projects: projectsRouter,
  skills: {
    list: publicProcedure
      .output(skillSchema.array())
      .handler(({ context }) =>
        context.db
          .select()
          .from(skills)
          .orderBy(
            asc(skills.category),
            asc(skills.sortOrder),
            asc(skills.name)
          )
      ),
  },
  tools: toolsRouter,
};
