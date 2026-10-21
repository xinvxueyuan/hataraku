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
const current = await import(pathToFileURL(root + "/packages/api/src/search/orama.ts").href);
const baseline = await import(pathToFileURL(root + "/packages/api/src/search/__baseline.ts").href);
const db = dbModule.createDb(url);

const measure = async (fn) => {
  const started = performance.now();
  await fn();
  return performance.now() - started;
};

const builds = { baseline: [], current: [] };

for (let index = 0; index < 6; index += 1) {
  builds.baseline.push(await measure(async () => baseline.createSearchIndex(db)));
  builds.current.push(await measure(async () => current.createSearchIndex(db)));
}

const hot = { baseline: [], current: [] };

for (let index = 0; index < 120; index += 1) {
  hot.baseline.push(await measure(async () => baseline.searchPosts(db, { page: 1, pageSize: 20, q: "限流" })));
  hot.current.push(await measure(async () => current.searchPosts(db, { page: 1, pageSize: 20, q: "限流" })));
}

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction) => Number(sorted[Math.floor((sorted.length - 1) * fraction)].toFixed(3));

  return { max: at(1), median: at(0.5), min: at(0), p95: at(0.95) };
};

console.log(JSON.stringify({
  baseline: { build: stats(builds.baseline), hot: stats(hot.baseline) },
  current: { build: stats(builds.current), hot: stats(hot.current) },
}, null, 2));

await db.$client.end();
