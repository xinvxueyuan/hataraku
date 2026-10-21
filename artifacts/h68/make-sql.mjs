// Writes artifacts/h68/apply-production.sql: one update per post, located by id.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const TAG = "$h68$";
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const statements = [
  "-- H68: the three bodies the hardened MDX boundary could not render.",
  "-- One statement per post, located by id; each replaces the whole body.",
];

try {
  for (const id of [2, 7, 30]) {
    const [row] = await sql`select id, title, body_md from posts where id = ${id}`;

    if (row === undefined) throw new Error(`missing post ${id}`);
    if (row.body_md.includes(TAG)) throw new Error(`post ${id} contains the dollar tag`);

    statements.push(
      `\n-- ${id}: ${row.title.replaceAll("\n", " ")}`,
      `update posts set body_md = ${TAG}${row.body_md}${TAG}, updated_at = now() where id = ${id};`
    );
  }
} finally {
  await sql.end({ timeout: 5 });
}

const file = "C:/dev/dsh/projects/hataraku/artifacts/h68/apply-production.sql";
writeFileSync(file, statements.join("\n") + "\n");
console.log(JSON.stringify({ bytes: statements.join("\n").length, statements: statements.filter((line) => line.startsWith("update")).length }, null, 2));
