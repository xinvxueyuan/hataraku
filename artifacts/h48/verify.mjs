// H48 evidence: the repair migration on a fresh database, on one that already has the table,
// and on one that lost it while its migration record still says it ran.
//
//   node artifacts/h48/verify.mjs
//
// Every database this creates is dropped again; the dev database is only migrated (idempotent).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

import { createRequire } from "node:module";
import { join } from "node:path";

const root = "C:/dev/dsh/projects/hataraku";

/** postgres-js is a dependency of packages/db, not of the workspace root. */
const require = createRequire(join(root, "packages/db/package.json"));
const postgres = require("postgres");
const envFile = `${root}/apps/server/.env`;

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/** A database URL on the same server, pointed at another database name. */
const withDatabase = (name) => {
  const url = new URL(process.env.DATABASE_URL ?? "");

  url.pathname = `/${name}`;

  return url.toString();
};

const admin = () => postgres(withDatabase("postgres"), { max: 1 });

const recreate = async (name) => {
  const sql = admin();

  try {
    await sql.unsafe(`drop database if exists ${name}`);
    await sql.unsafe(`create database ${name}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
};

const dropDatabase = async (name) => {
  const sql = admin();

  try {
    await sql.unsafe(`drop database if exists ${name}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
};

/** Runs the repo's own migration entry point, exactly as `pnpm run db:migrate` does. */
const migrate = (name) => {
  const result = spawnSync(process.execPath, ["src/migrate.ts"], {
    cwd: `${root}/apps/server`,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: withDatabase(name) },
  });

  return {
    ok: result.status === 0,
    stderr: (result.stderr ?? "").trim().split("\n").slice(-3).join(" | "),
  };
};

const inspect = async (name) => {
  const sql = postgres(withDatabase(name), { max: 1 });

  try {
    const [row] = await sql`
      select
        to_regclass('public.two_factor') is not null as table_exists,
        (select count(*) from information_schema.columns
          where table_name = 'two_factor') as column_count,
        (select count(*) from information_schema.columns
          where table_name = 'user' and column_name = 'two_factor_enabled') as user_column,
        (select count(*) from pg_indexes
          where tablename = 'two_factor') as index_count,
        (select count(*) from pg_constraint
          where conname = 'two_factor_user_id_user_id_fkey') as fk_count,
        (select count(*) from drizzle.__drizzle_migrations) as applied
    `;

    return row;
  } finally {
    await sql.end({ timeout: 5 });
  }
};

const results = {};

// a. A database that never saw any migration.
await recreate("h48_fresh");
results.freshMigrate = migrate("h48_fresh");
results.fresh = await inspect("h48_fresh");

// b. A database that already has the table (the dev database): the repair must be a no-op.
results.existingMigrate = migrate("hataraku");
results.existing = await inspect("hataraku");

// c. The production shape that started this task: migrations recorded, table missing.
await recreate("h48_prodlike");
migrate("h48_prodlike");

const broken = postgres(withDatabase("h48_prodlike"), { max: 1 });

try {
  await broken.unsafe("drop table if exists two_factor");
  await broken.unsafe("alter table \"user\" drop column if exists two_factor_enabled");
  await broken.unsafe(
    "delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)"
  );
} finally {
  await broken.end({ timeout: 5 });
}

results.brokenBefore = await inspect("h48_prodlike");
results.repairMigrate = migrate("h48_prodlike");
results.brokenAfter = await inspect("h48_prodlike");

// d. The snapshot chain is whole again: generate must not re-emit two_factor.
const before = readdirSync(`${root}/packages/db/src/migrations`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// The repo's own command, so this reproduces what a developer (and CI) actually runs.
const generated = spawnSync("pnpm", ["run", "db:generate"], {
  cwd: `${root}/packages/db`,
  encoding: "utf8",
  shell: true,
});
const after = readdirSync(`${root}/packages/db/src/migrations`, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

results.generate = {
  exitCode: generated.status,
  newFolders: after.filter((name) => !before.includes(name)),
  output: `${generated.stdout ?? ""}${generated.stderr ?? ""}`
    .trim()
    .split("\n")
    .slice(-2)
    .join(" | "),
};

await dropDatabase("h48_fresh");
await dropDatabase("h48_prodlike");

const checks = {
  freshHasTable: results.fresh.table_exists === true,
  freshHasUserColumn: Number(results.fresh.user_column) === 1,
  // The primary key plus the secret and user_id indexes.
  freshHasBothIndexes: Number(results.fresh.index_count) === 3,
  freshHasForeignKey: Number(results.fresh.fk_count) === 1,
  existingDatabaseUnaffected: results.existingMigrate.ok && results.existing.table_exists === true,
  brokenHadNoTable: results.brokenBefore.table_exists === false,
  repairRestoredTable: results.brokenAfter.table_exists === true,
  repairRestoredUserColumn: Number(results.brokenAfter.user_column) === 1,
  repairRestoredForeignKey: Number(results.brokenAfter.fk_count) === 1,
  generateEmitsNothing: results.generate.exitCode === 0 && results.generate.newFolders.length === 0,
};

writeFileSync("artifacts/h48/evidence.json", JSON.stringify({ checks, results }, null, 2));

console.log(JSON.stringify({ checks, results }, null, 2));

if (Object.values(checks).some((value) => value !== true)) {
  process.exitCode = 1;
}
