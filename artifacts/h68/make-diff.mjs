// Writes artifacts/h68/diff-<id>.txt: the changed lines, before and after, for each post.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const out = "C:/dev/dsh/projects/hataraku/artifacts/h68";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const summary = {};

try {
  for (const id of [2, 7, 30]) {
    const [row] = await sql`select body_md from posts where id = ${id}`;
    const before = readFileSync(`${out}/body-${id}.before.md`, "utf8").split("\n");
    const after = row.body_md.split("\n");

    if (before.length !== after.length) throw new Error(`post ${id} changed its line count`);

    const changed = [];

    before.forEach((line, index) => {
      if (line !== after[index]) changed.push({ after: after[index], before: line, line: index + 1 });
    });

    const diff = changed
      .map((entry) => `${entry.line}:\n- ${entry.before}\n+ ${entry.after}`)
      .join("\n\n");

    writeFileSync(`${out}/diff-${id}.txt`, diff + "\n");
    writeFileSync(`${out}/body-${id}.after.md`, row.body_md);
    summary[id] = { changed: changed.length, lines: changed.map((entry) => entry.line) };
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(JSON.stringify(summary, null, 2));
