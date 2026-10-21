import { sql } from "drizzle-orm";

import { publicRoute } from "#src/openapi-public.ts";
import { publicProcedure } from "#src/procedures.ts";

export const health = publicProcedure
  .route(publicRoute("health"))
  .handler(async ({ context }) => {
    await context.db.execute(sql`select 1`);

    return { status: "ok" as const };
  });
