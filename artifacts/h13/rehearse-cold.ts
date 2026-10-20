/**
 * Rehearsal harness for scripts/migrate-content.ts.
 *
 * Creates an empty database beside the local container's "hataraku" one, applies the repository
 * migrations, and drops it again. Run the migration script between the two commands so the copy is
 * proven on a cold target, where every table takes the INSERT path instead of the upsert update.
 *
 *   REHEARSAL_ADMIN_URL=<local admin connection string> node artifacts/h13/rehearse-cold.ts create
 *   REHEARSAL_ADMIN_URL=<local admin connection string> node artifacts/h13/rehearse-cold.ts drop
 *
 * REHEARSAL_ADMIN_URL points at the server, not the "hataraku" database: creating a database needs
 * a connection to another one. No connection string lives in this repository.
 */

import { createRequire } from "node:module";

import { createDb } from "../../packages/db/src/index.ts";
import { migrateDatabase } from "../../packages/db/src/migrate.ts";

const DATABASE_NAME = "hataraku_h13_rehearsal";

const adminUrl = process.env.REHEARSAL_ADMIN_URL;

if (adminUrl === undefined || adminUrl === "") {
  throw new Error("REHEARSAL_ADMIN_URL is not set");
}

const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${DATABASE_NAME}`;

const require = createRequire(
  new URL("../../packages/db/package.json", import.meta.url)
);

// SAFETY: postgres is the driver @hataraku/db depends on; this harness calls only unsafe and end,
// which the create/drop commands exercise on every run.
const postgres = require("postgres") as (
  url: string
) => {
  end: () => Promise<void>;
  unsafe: (query: string) => Promise<unknown[]>;
};

const command = process.argv[2];
const admin = postgres(adminUrl);

try {
  if (command === "create") {
    await admin.unsafe(`drop database if exists "${DATABASE_NAME}" with (force)`);
    await admin.unsafe(`create database "${DATABASE_NAME}"`);

    const db = createDb(targetUrl.href);

    try {
      await migrateDatabase(db);
    } finally {
      await db.$client.end();
    }

    console.log(`created ${targetUrl.hostname}${targetUrl.pathname}`);
  } else if (command === "drop") {
    await admin.unsafe(`drop database if exists "${DATABASE_NAME}" with (force)`);
    console.log(`dropped ${targetUrl.hostname}${targetUrl.pathname}`);
  } else {
    throw new Error("usage: rehearse-cold.ts create|drop");
  }
} finally {
  await admin.end();
}
