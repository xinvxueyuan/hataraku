import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

import { siteProfile } from "@hataraku/db/schema/pages";

import { publicProcedure } from "#src/procedures.ts";
import { siteProfileSchema } from "#src/schemas.ts";

/** The single site profile row, pinned to id = 1 by the table's check constraint. */
const SITE_PROFILE_ID = 1;

export const siteRouter = {
  profile: publicProcedure
    .output(siteProfileSchema)
    .handler(async ({ context }) => {
      const [row] = await context.db
        .select()
        .from(siteProfile)
        .where(eq(siteProfile.id, SITE_PROFILE_ID))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "Site profile is not set",
        });
      }

      return row;
    }),
};
