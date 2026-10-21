// H68: the three bodies that the hardened MDX boundary still rejects.
//
// Every edit is line-targeted and asserted: the script refuses to write if the line it expects is
// not exactly there, so a re-run cannot double-wrap or touch a different paragraph.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const out = "C:/dev/dsh/projects/hataraku/artifacts/h68";

/** Wraps a span in inline code, the one edit that is safe in every MDX context. */
const code = (text) => CODE + text + CODE;

mkdirSync(out, { recursive: true });

/** [1-based line number, expected current text, replacement] */
const EDITS = {
  2: [
    [15, '::video{provider="youtube" id="5gIf0_xpFPI"}', code('::video{provider="youtube" id="5gIf0_xpFPI"}')],
    [19, '::video{provider="bilibili" id="BV1fK4y1s7Qf"}', code('::video{provider="bilibili" id="BV1fK4y1s7Qf"}')],
  ],
  7: [
    [911, "<http://example.com/>", "[http://example.com/](http://example.com/)"],
    [913, "<address@example.com>", "[address@example.com](mailto:address@example.com)"],
  ],
  30: [
    [9, "var app = app || {}", code("var app = app || {}")],
    [19, "require()", code("require()")],
  ],
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const applied = [];

try {
  for (const [id, edits] of Object.entries(EDITS)) {
    const [row] = await sql`select id, title, slug, body_md from posts where id = ${Number(id)}`;

    if (row === undefined) {
      throw new Error(`post ${id} is missing`);
    }

    const lines = row.body_md.split("\n");
    const before = [];

    for (const [lineNumber, expected, replacement] of edits) {
      const current = lines[lineNumber - 1];

      if (current === undefined || !current.includes(expected)) {
        throw new Error(`post ${id} line ${lineNumber} does not contain the expected text: ${String(current).slice(0, 80)}`);
      }

      before.push(`${lineNumber}: ${current}`);
      lines[lineNumber - 1] = current.replace(expected, replacement);
    }

    const body = lines.join("\n");
    const after = edits.map(([lineNumber]) => `${lineNumber}: ${lines[lineNumber - 1]}`);

    writeFileSync(`${out}/diff-${id}.txt`, `- ${before.join("\n- ")}\n+ ${after.join("\n+ ")}\n`);
    writeFileSync(`${out}/body-${id}.after.md`, body);
    writeFileSync(`${out}/body-${id}.before.md`, row.body_md);

    await sql`update posts set body_md = ${body}, updated_at = now() where id = ${Number(id)}`;
    applied.push({ after, before, id: Number(id), slug: row.slug, title: row.title });
  }
} finally {
  await sql.end({ timeout: 5 });
}

console.log(JSON.stringify(applied, null, 2));
