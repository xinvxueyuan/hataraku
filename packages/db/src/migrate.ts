import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";

import type { Database } from "#src/index.ts";

const migrationsFolder = fileURLToPath(new URL("migrations", import.meta.url));
const BREAKPOINT = "--> statement-breakpoint";
const MIGRATIONS_TABLE = '"drizzle"."__drizzle_migrations"';

const MIGRATIONS_TABLE_DDL = [
  'create table if not exists "drizzle"."__drizzle_migrations" (',
  '  "id" serial primary key,',
  '  "hash" text not null,',
  '  "created_at" bigint,',
  '  "name" text,',
  '  "applied_at" timestamp with time zone default now()',
  ")",
].join("\n");

const migrationFolders = (): string[] =>
  readdirSync(migrationsFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      readdirSync(path.join(migrationsFolder, name)).includes("migration.sql")
    )
    .toSorted();

const appliedNames = async (db: Database): Promise<Set<string>> => {
  const rows = await db.$client.unsafe<{ name: string }[]>(
    `select "name" from ${MIGRATIONS_TABLE} where "name" is not null`
  );

  return new Set(rows.map((row) => row.name));
};

/**
 * Applies every migration folder once, in name order. The folder name is the identity; a migration
 * is immutable after it lands, so a name that is already recorded is skipped without re-reading its
 * SQL.
 */
export const migrateDatabase = async (db: Database) => {
  await db.execute(sql.raw('create schema if not exists "drizzle"'));
  await db.execute(sql.raw(MIGRATIONS_TABLE_DDL));

  const applied = await appliedNames(db);

  for (const name of migrationFolders()) {
    if (applied.has(name)) {
      continue;
    }

    const migration = readFileSync(
      path.join(migrationsFolder, name, "migration.sql"),
      "utf-8"
    );

    const statements = migration
      .split(BREAKPOINT)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    const hash = createHash("sha256").update(migration).digest("hex");

    /* oxlint-disable no-await-in-loop -- a migration is a transaction; the next one must not start before it commits */
    await db.transaction(async (tx) => {
      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }

      await tx.execute(
        sql.raw(
          `insert into ${
            MIGRATIONS_TABLE
          } ("hash", "created_at", "name") values (` +
            `'${hash}', ${Date.now()}, '${name.replaceAll("'", "''")}')`
        )
      );
    });
    /* oxlint-enable no-await-in-loop */
  }
};
