/**
 * H41 HTTP probe: starts the real API + web dev servers against the real database, fetches
 * /search?q=... for the acceptance table, and tears both process trees down afterwards.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const root = "C:/dev/dsh/projects/hataraku";
const envFile = readFileSync(root + "/apps/server/.env", "utf8");
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match !== null) {
    env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const children = [];
const start = (cwd, args, extraEnv) => {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "ignore",
  });
  children.push(child);
  return child;
};

const killTrees = () => {
  for (const child of children) {
    if (child.pid !== undefined) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    }
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error("timed out waiting for " + url);
};

const decode = (value) =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'");

const parse = (html) => {
  const text = html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ");
  const countMatch = /找到\s*(\d+)\s*条结果/.exec(text);
  const listMatch = /data-slot="search-results"([\s\S]*?)<\/ul>/.exec(text);
  const firstMatch =
    listMatch === null ? null : /href="\/posts\/([^"]+)"[^>]*>([^<]+)</.exec(listMatch[1]);
  return {
    count: countMatch === null ? (text.includes("没有匹配的文章") ? 0 : null) : Number(countMatch[1]),
    first: firstMatch === null ? "-" : decode(firstMatch[2].trim()),
    slug: firstMatch === null ? "-" : firstMatch[1],
  };
};

const apiPort = "3311";
const webPort = "3310";
const baseEnv = {
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: "http://localhost:" + webPort,
  DATABASE_URL: env.DATABASE_URL,
};
start(root + "/apps/server", ["src/index.ts"], { ...baseEnv, PORT: apiPort });
await waitFor("http://localhost:" + apiPort + "/api/health");
start(root + "/apps/web", ["node_modules/next/dist/bin/next", "dev", "--port", webPort], {
  ...baseEnv,
  NEXT_DIST_DIR: ".next-test-" + webPort,
  SERVER_URL: "http://localhost:" + apiPort,
});
await waitFor("http://localhost:" + webPort + "/");

const queries = [
  "Goo", "goog", "Google", "google ai", "限", "限流", "限流网关", "网", "网关",
  "不存在的词xyz", "a&b",
];
const rows = [];
for (const q of queries) {
  const started = performance.now();
  const response = await fetch(
    "http://localhost:" + webPort + "/search?q=" + encodeURIComponent(q)
  );
  const html = await response.text();
  rows.push({ ...parse(html), ms: Number((performance.now() - started).toFixed(1)), q, status: response.status });
}
console.log(JSON.stringify(rows, null, 2));
killTrees();
await sleep(500);
