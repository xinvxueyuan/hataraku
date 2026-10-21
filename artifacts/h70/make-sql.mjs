// Writes artifacts/h70/apply-production.sql: one update, located by id.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const TAG = "$h70$";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const statements = [
  "-- H70: the indented samples in the Markdown article render as code blocks again.",
  "-- One statement, located by id; it replaces the whole body.",
];

try {
  for (const id of [7]) {
    const [row] = await sql`select id, title, body_md from posts where id = ${id}`;

    if (row === undefined) throw new Error(`missing post ${id}`);
    if (row.body_md.includes(TAG)) throw new Error(`post ${id} contains the dollar tag`);

    statements.push(
      `\n-- ${id}: ${row.title}`,
      `update posts set body_md = ${TAG}${row.body_md}${TAG}, updated_at = now() where id = ${id};`
    );
  }
} finally {
  await sql.end({ timeout: 5 });
}

const file = "C:/dev/dsh/projects/hataraku/artifacts/h70/apply-production.sql";

writeFileSync(file, statements.join("\n") + "\n");
console.log(JSON.stringify({ bytes: statements.join("\n").length }, null, 2));
