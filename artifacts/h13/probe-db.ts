/**
 * Read-only probe: describes one database and counts every public table.
 *
 * Run with PROBE_DATABASE_URL set. The URL is never printed: only the host, database, user and
 * parameter names, which is enough to tell two endpoints apart without putting a credential on
 * screen.
 */

import { createRequire } from "node:module";

interface Row {
  [key: string]: unknown;
}

interface Sql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  end: () => Promise<void>;
  unsafe: (query: string, values?: unknown[]) => Promise<Row[]>;
}

type PostgresFactory = (url: string, options?: { max?: number }) => Sql;

const require = createRequire(
  new URL("../../packages/db/package.json", import.meta.url)
);

const postgres = require("postgres") as PostgresFactory;

const url = process.env.PROBE_DATABASE_URL;

if (!url) {
  throw new Error("PROBE_DATABASE_URL is not set");
}

const parsed = new URL(url);

console.log(
  `host=${parsed.hostname} db=${parsed.pathname.slice(1)} user=${parsed.username} params=${[...parsed.searchParams.keys()].join(",")}`
);

const sql = postgres(url, { max: 1 });

try {
  const tables = await sql.unsafe(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
  );

  console.log(`public tables: ${tables.length}`);

  for (const row of tables) {
    const table = String(row.table_name);
    const [count] = await sql.unsafe(
      `select count(*)::int as n from "${table}"`
    );
    console.log(`${table.padEnd(28)} ${String(count?.n ?? "?")}`);
  }

  const [version] = await sql.unsafe("select version() as v");
  console.log(String(version?.v));
} finally {
  await sql.end();
}
