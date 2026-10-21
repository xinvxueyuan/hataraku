/**
 * H60 search-snippet probe: real database, real index. Run before and after the index-side
 * Markdown stripping change; the JSON is diffed by the report.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = "C:/dev/dsh/projects/hataraku";
const databaseUrl = readFileSync(root + "/apps/server/.env", "utf8")
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim();

const dbModule = await import(pathToFileURL(root + "/packages/db/src/index.ts").href);
const search = await import(pathToFileURL(root + "/packages/api/src/search/orama.ts").href);
const db = dbModule.createDb(databaseUrl);

const queries = ["Goo", "goog", "Google", "限", "限流", "Markdown", "安全", "Python", "不存在的词xyz"];
const rows = [];

for (const q of queries) {
  const result = await search.searchPosts(db, { page: 1, pageSize: 10, q });
  const snippets = result.items
    .filter((hit) => hit.snippet !== null)
    .slice(0, 3)
    .map((hit) => ({ slug: hit.slug, text: hit.snippet.text }));

  rows.push({
    count: result.total,
    first: result.items[0]?.title ?? null,
    firstSlug: result.items[0]?.slug ?? null,
    q,
    snippets,
  });
}

const started = performance.now();
const built = await search.createSearchIndex(db);
const buildMs = performance.now() - started;

const hot = [];

for (let index = 0; index < 100; index += 1) {
  const at = performance.now();
  await search.searchPosts(db, { page: 1, pageSize: 10, q: "限流" });
  hot.push(performance.now() - at);
}

hot.sort((left, right) => left - right);
const p = (fraction) => Number(hot[Math.floor((hot.length - 1) * fraction)].toFixed(3));

const forbidden = ["](", "|", "**", "__", String.fromCharCode(96), "---"];
const violations = [];

for (const row of rows) {
  for (const snippet of row.snippets) {
    for (const needle of forbidden) {
      if (snippet.text.includes(needle)) {
        violations.push({ needle, q: row.q, slug: snippet.slug, text: snippet.text });
      }
    }

    if (snippet.text.trimStart().startsWith("#")) {
      violations.push({ needle: "line-start #", q: row.q, slug: snippet.slug, text: snippet.text });
    }
  }
}

console.log(JSON.stringify({
  buildMs: Number(buildMs.toFixed(2)),
  docCount: built.documentCount,
  hotP50: p(0.5),
  hotP95: p(0.95),
  rows,
  violations,
}, null, 2));

await db.$client.end();
