import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const fileUrl = readFileSync(root + "/apps/server/.env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();
const url = process.env.DATABASE_URL ?? fileUrl;

const dbModule = await import(pathToFileURL(root + "/packages/db/src/index.ts").href);
const db = dbModule.createDb(url);

const tables = await db.$client.unsafe(
  "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
);
const rows = {};
for (const table of tables) {
  const [row] = await db.$client.unsafe('select count(*)::int as n from "' + table.table_name + '"');
  rows[table.table_name] = row.n;
}

const [content] = await db.$client.unsafe(
  "select (select count(*)::int from posts where published and not draft) as published_posts, (select count(*)::int from categories) as categories, (select count(*)::int from tags) as tags, (select count(*)::int from post_tags) as post_tags"
);
const [searchIndex] = await db.$client.unsafe(
  "select to_regclass('public.search_index')::text as name"
);
const [nav] = await db.$client.unsafe(
  "select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'site_profile' and column_name = 'nav'"
);
const [guardTables] = await db.$client.unsafe(
  "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name in ('verification','todos','two_factor')"
);

console.log(JSON.stringify({ content, guardTables: guardTables.n, navColumns: nav.n, rows, searchIndex: searchIndex.name }, null, 2));
await db.$client.end();
