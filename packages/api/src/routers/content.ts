import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import {
  changelogEntries,
  friends,
  microPosts,
  projects,
  skills,
  tools,
} from "@hataraku/db/schema/content";

import { paginate } from "#src/pagination.ts";
import { publicProcedure } from "#src/procedures.ts";
import {
  changelogEntrySchema,
  friendSchema,
  listChangelogInput,
  listMicroInput,
  listProjectsInput,
  listToolsInput,
  microPostSchema,
  paginatedSchema,
  projectSchema,
  skillSchema,
  slugInput,
  toolSchema,
} from "#src/schemas.ts";

const projectsRouter = {
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
};

const microRouter = {
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

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),
};

const changelogRouter = {
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
