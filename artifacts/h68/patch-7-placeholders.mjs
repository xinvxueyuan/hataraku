import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [row] = await sql`select body_md from posts where id = 7`;
  const lines = row.body_md.split("\n");
  const touched = [];

  for (const lineNumber of [391, 399]) {
    const current = lines[lineNumber - 1];
    const placeholder = "<code goes here>";

    if (current === undefined || !current.includes(placeholder) || current.includes(CODE)) {
      throw new Error(`line ${lineNumber} is not the expected placeholder: ${String(current)}`);
    }

    lines[lineNumber - 1] = current.replace(placeholder, CODE + placeholder + CODE);
    touched.push(lineNumber + ": " + lines[lineNumber - 1]);
  }

  const body = lines.join("\n");

  writeFileSync("C:/dev/dsh/projects/hataraku/artifacts/h68/body-7.after.md", body);
  await sql`update posts set body_md = ${body}, updated_at = now() where id = 7`;
  console.log(JSON.stringify(touched, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
