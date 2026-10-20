import { createRequire } from "node:module";

const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const postgres = require("postgres");

const url = process.env.PROBE_DATABASE_URL;
if (!url) throw new Error("PROBE_DATABASE_URL is not set");

const sql = postgres(url);
try {
  const rows = await sql.unsafe("select datname from pg_database where not datistemplate order by 1");
  console.log(rows.map((r) => r.datname).join(", "));
} finally {
  await sql.end();
}
