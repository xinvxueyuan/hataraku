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
const guard = await import(pathToFileURL(root + "/packages/api/src/mdx-guard.ts").href);
const db = dbModule.createDb(url);
const rows = await db.$client.unsafe("select id, title, body_md from posts where published and not draft order by id");
for (const row of rows) {
  try {
    guard.assertSafeMdx(row.body_md ?? "");
  } catch (error) {
    console.log("REJECT", row.id, row.title, "|", error.reason);
    const lines = (row.body_md ?? "").split("\n");
    for (const [index, line] of lines.entries()) {
      if (/require\s*\(|import\s|export\s|<script/i.test(line)) {
        console.log("  ", index + 1, line.slice(0, 180));
      }
    }
  }
}
await db.$client.end();
