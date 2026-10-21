/**
 * H41 benchmark: cold build, hot query latency, and the required query table against the real
 * database. Run from anywhere; imports are absolute so package resolution stays inside each
 * workspace package.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const envFile = readFileSync(root + "/apps/server/.env", "utf8");
const databaseUrl = envFile
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();

const dbModule = await import(pathToFileURL(root + "/packages/db/src/index.ts").href);
const searchModule = await import(
  pathToFileURL(root + "/packages/api/src/search/orama.ts").href
);

const db = dbModule.createDb(databaseUrl);

const buildStart = performance.now();
const built = await searchModule.createSearchIndex(db);
const buildMs = performance.now() - buildStart;

const coldStart = performance.now();
const cold = await searchModule.searchPosts(db, { page: 1, pageSize: 20, q: "goog" });
const coldMs = performance.now() - coldStart;

const queries = [
  "Goo", "goog", "Google", "google ai", "限", "限流", "限流网关", "网", "网关",
  "不存在的词xyz", "a&b",
];
const table = [];
for (const q of queries) {
  const samples = [];
  let last;
  for (let i = 0; i < 7; i += 1) {
    const start = performance.now();
    last = await searchModule.searchPosts(db, { page: 1, pageSize: 20, q });
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  table.push({
    count: last.total,
    first: last.items[0]?.title ?? "-",
    medianMs: Number(samples[3].toFixed(3)),
    q,
  });
}

const hot = [];
for (let i = 0; i < 100; i += 1) {
  const start = performance.now();
  await searchModule.searchPosts(db, { page: 1, pageSize: 20, q: "限流" });
  hot.push(performance.now() - start);
}
hot.sort((a, b) => a - b);
const p = (fraction) => Number(hot[Math.floor((hot.length - 1) * fraction)].toFixed(3));

console.log(JSON.stringify({
  buildMs: Number(buildMs.toFixed(2)),
  coldMs: Number(coldMs.toFixed(2)),
  docCount: built.documentCount,
  hotP50: p(0.5),
  hotP95: p(0.95),
  table,
}, null, 2));

await db.$client.end();
