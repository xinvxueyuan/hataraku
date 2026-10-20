import { createDb } from "@hataraku/db";
import { migrateDatabase } from "@hataraku/db/migrate";

import { env } from "#src/env.ts";

const db = createDb(env.DATABASE_URL);

await migrateDatabase(db);

await db.$client.end();
