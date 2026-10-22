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
const search = await import(pathToFileURL(root + "/packages/api/src/search/orama.ts").href);
const db = dbModule.createDb(url);
const measure = async (fn) => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};
const builds = [];
for (let i = 0; i < 6; i += 1) builds.push(await measure(() => search.createSearchIndex(db)));
const stat = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const p = (f) => Number(sorted[Math.floor((sorted.length - 1) * f)].toFixed(3));
  return { max: p(1), median: p(0.5), min: p(0), p95: p(0.95) };
};
const hot = [];
await search.searchPosts(db, { page: 1, pageSize: 20, q: "限流" });
for (let i = 0; i < 120; i += 1) hot.push(await measure(() => search.searchPosts(db, { page: 1, pageSize: 20, q: "限流" })));
const queries = ["Goo", "限流", "Markdown", "安全"];
const rows = [];
for (const q of queries) {
  const result = await search.searchPosts(db, { page: 1, pageSize: 20, q });
  rows.push({
    q,
    total: result.total,
    items: result.items.map((item) => ({
      id: item.id,
      title: item.title,
      categorySlug: item.categorySlug,
      tags: item.tags,
      readingMinutes: item.readingMinutes,
      publishedAt: item.publishedAt,
      rank: item.rank,
    })),
  });
}
const body = {
  build: stat(builds),
  hot: stat(hot),
  documentCount: (await search.createSearchIndex(db)).documentCount,
  rows,
};
console.log(JSON.stringify(body, null, 2));
await db.$client.end();
