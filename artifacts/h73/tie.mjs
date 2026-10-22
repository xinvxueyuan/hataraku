import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const url = readFileSync(root + "/apps/server/.env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();
const dbModule = await import(pathToFileURL(root + "/packages/db/src/index.ts").href);
const schema = await import(pathToFileURL(root + "/packages/db/src/schema/posts.ts").href);
const search = await import(pathToFileURL(root + "/packages/api/src/search/orama.ts").href);
const db = dbModule.createDb(url);
const token = "tiebreakprobe";
const common = { bodyMd: token, description: token, published: true, title: "Tie break probe" };
const rows = await db
  .insert(schema.posts)
  .values([
    { ...common, publishedAt: new Date("2020-01-01T00:00:00.000Z"), slug: "tie-old-probe" },
    { ...common, publishedAt: new Date("2021-01-01T00:00:00.000Z"), slug: "tie-new-probe" },
  ])
  .returning({ id: schema.posts.id, slug: schema.posts.slug, publishedAt: schema.posts.publishedAt });
try {
  const result = await search.searchPosts(db, { page: 1, pageSize: 20, q: token });
  const hits = result.items.filter((item) => rows.some((row) => row.id === item.id));
  console.log(JSON.stringify({
    query: token,
    expected: "newest (2021) first when rank is equal",
    hits: hits.map((hit) => ({ id: hit.id, slug: hit.slug, rank: hit.rank, publishedAt: hit.publishedAt })),
  }, null, 2));
} finally {
  const ids = rows.map((row) => row.id);
  await db.$client.unsafe("delete from posts where id = any($1::int[])", [ids]);
  await db.$client.end();
}
