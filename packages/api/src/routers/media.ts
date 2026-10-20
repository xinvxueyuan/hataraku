import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { albumPhotos, albums, devices } from "@hataraku/db/schema/media";
import { diaryEntries, timelineEntries } from "@hataraku/db/schema/pages";

import { paginate } from "#src/pagination.ts";
import { adminProcedure, publicProcedure } from "#src/procedures.ts";
import {
  ALLOWED_MIME_TYPES,
  createPresignedUpload,
  hasR2Config,
  planUpload,
  requestUploadInput,
  UPLOAD_MAX_BYTES,
  UPLOAD_PREFIXES,
} from "#src/r2.ts";
import {
  albumWithPhotosSchema,
  deviceSchema,
  diaryEntrySchema,
  listAlbumsInput,
  listDevicesInput,
  listDiaryInput,
  listTimelineInput,
  paginatedSchema,
  albumSchema,
  slugInput,
  timelineEntrySchema,
  uploadPolicySchema,
  uploadTicketSchema,
} from "#src/schemas.ts";

const albumsRouter = {
  bySlug: publicProcedure
    .input(slugInput)
    .output(albumWithPhotosSchema)
    .handler(async ({ context, input }) => {
      const [album] = await context.db
        .select()
        .from(albums)
        .where(and(eq(albums.published, true), eq(albums.slug, input.slug)))
        .limit(1);

      if (!album) {
        throw new ORPCError("NOT_FOUND", { message: "Album not found" });
      }

      const photos = await context.db
        .select()
        .from(albumPhotos)
        .where(eq(albumPhotos.albumId, album.id))
        .orderBy(asc(albumPhotos.sortOrder), asc(albumPhotos.id));

      return { ...album, photoCount: photos.length, photos };
    }),

  list: publicProcedure
    .input(listAlbumsInput)
    .output(paginatedSchema(albumSchema))
    .handler(async ({ context, input }) => {
      const filters: SQL[] = [eq(albums.published, true)];

      if (input.tag !== undefined) {
        filters.push(sql`${albums.tags} @> array[${input.tag}]::text[]`);
      }

      const where = and(...filters);

      const [rows, totalRow] = await Promise.all([
        context.db
          .select()
          .from(albums)
          .where(where)
          .orderBy(desc(albums.date), asc(albums.sortOrder))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        context.db
          .select({ total: sql<number>`count(*)::int` })
          .from(albums)
          .where(where),
      ]);

      return paginate(rows, totalRow[0]?.total ?? 0, input);
    }),
};

const uploadsRouter = {
  /** What the form shows before a file is chosen: accepted types, the size cap, the prefixes. */
  policy: adminProcedure.output(uploadPolicySchema).handler(() => ({
    allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    maxBytes: UPLOAD_MAX_BYTES,
    prefixes: [...UPLOAD_PREFIXES],
  })),

  /**
   * Signs one PUT for one image. The browser sends the bytes straight to R2, so this answers with a
   * short-lived URL and the object key the form stores; the R2 credentials stay on the server.
   */
  presign: adminProcedure
    .input(requestUploadInput)
    .output(uploadTicketSchema)
    .handler(async ({ input }) => {
      const plan = planUpload(input);

      if (plan === null) {
        throw new ORPCError("UNSUPPORTED_MEDIA_TYPE", {
          message: `${input.contentType} is not an image this deployment accepts. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}.`,
        });
      }

      if (!hasR2Config()) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message:
            "Object storage is not configured on this deployment, so uploads are unavailable.",
        });
      }

      return await createPresignedUpload(plan);
    }),
};

export const mediaRouter = {
  albums: albumsRouter,
  devices: {
    list: publicProcedure
      .input(listDevicesInput)
      .output(paginatedSchema(deviceSchema))
      .handler(async ({ context, input }) => {
        const filters: SQL[] = [eq(devices.published, true)];

        if (input.category !== undefined) {
          filters.push(eq(devices.category, input.category));
        }

        const where = and(...filters);

        const [rows, totalRow] = await Promise.all([
          context.db
            .select()
            .from(devices)
            .where(where)
            .orderBy(asc(devices.sortOrder), asc(devices.name))
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
          context.db
            .select({ total: sql<number>`count(*)::int` })
            .from(devices)
            .where(where),
        ]);

        return paginate(rows, totalRow[0]?.total ?? 0, input);
      }),
  },
  diary: {
    list: publicProcedure
      .input(listDiaryInput)
      .output(paginatedSchema(diaryEntrySchema))
      .handler(async ({ context, input }) => {
        const filters: SQL[] = [eq(diaryEntries.published, true)];

        if (input.tag !== undefined) {
          filters.push(
            sql`${diaryEntries.tags} @> array[${input.tag}]::text[]`
          );
        }

        if (input.from !== undefined) {
          filters.push(sql`${diaryEntries.date} >= ${input.from}::date`);
        }

        if (input.to !== undefined) {
          filters.push(sql`${diaryEntries.date} <= ${input.to}::date`);
        }

        const where = and(...filters);

        const [rows, totalRow] = await Promise.all([
          context.db
            .select()
            .from(diaryEntries)
            .where(where)
            .orderBy(desc(diaryEntries.date), desc(diaryEntries.createdAt))
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
          context.db
            .select({ total: sql<number>`count(*)::int` })
            .from(diaryEntries)
            .where(where),
        ]);

        return paginate(rows, totalRow[0]?.total ?? 0, input);
      }),
  },
  timeline: {
    list: publicProcedure
      .input(listTimelineInput)
      .output(paginatedSchema(timelineEntrySchema))
      .handler(async ({ context, input }) => {
        const filters: SQL[] = [eq(timelineEntries.published, true)];

        if (input.category !== undefined) {
          filters.push(eq(timelineEntries.category, input.category));
        }

        const where = and(...filters);

        const [rows, totalRow] = await Promise.all([
          context.db
            .select()
            .from(timelineEntries)
            .where(where)
            .orderBy(desc(timelineEntries.date), asc(timelineEntries.sortOrder))
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
          context.db
            .select({ total: sql<number>`count(*)::int` })
            .from(timelineEntries)
            .where(where),
        ]);

        return paginate(rows, totalRow[0]?.total ?? 0, input);
      }),
  },
  uploads: uploadsRouter,
};
