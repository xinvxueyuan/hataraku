/**
 * Transport probe: proves how each column type of the content tables survives a bound parameter.
 *
 * Run with PROBE_DATABASE_URL set (a scratch database: it creates and drops a temporary table).
 */

import { createRequire } from "node:module";

interface Row {
  [key: string]: boolean | number | string | null | string[];
}

interface Sql {
  end: () => Promise<void>;
  unsafe: (query: string, parameters?: (boolean | number | string | null | string[] | object)[]) => Promise<Row[]>;
}

type PostgresFactory = (url: string) => Sql;

const require = createRequire(
  new URL("../../packages/db/package.json", import.meta.url)
);

// SAFETY: postgres is the driver @hataraku/db depends on, and this is the subset of its client
// this script calls; the rehearsal below exercises every call site.
const postgres = require("postgres") as PostgresFactory;

const url = process.env.PROBE_DATABASE_URL;

if (!url) {
  throw new Error("PROBE_DATABASE_URL is not set");
}

const sql = postgres(url);

try {
  await sql.unsafe("create temporary table probe (tags text[], title text, at timestamptz, meta jsonb, flag boolean, day date)");

  const tags = ["限流", "monorepo"];
  const at = "2026-10-20 12:00:00.695084+00";
  const day = "2026-10-20";
  const meta = { alt: "封面", src: "/cover.png", width: 1200 };

  await sql.unsafe(
    "insert into probe (tags, title, at, meta, flag, day) values ($1::text[], $2::text, $3::text::timestamptz, $4::jsonb, $5::boolean, $6::text::date)",
    [tags, "夜行栈", at, meta, true, day]
  );

  const rows = await sql.unsafe(
    "select tags::text as tags, at::text as at, meta::text as meta, flag, day::text as day from probe"
  );

  console.log(JSON.stringify(rows, null, 2));

  const [roundTrip] = await sql.unsafe(
    "select (tags = $1::text[]) as tags_equal, (at = $2::text::timestamptz) as at_equal, (day = $3::text::date) as day_equal from probe",
    [tags, at, day]
  );

  console.log(JSON.stringify(roundTrip, null, 2));
} finally {
  await sql.end();
}
