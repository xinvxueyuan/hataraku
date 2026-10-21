// H68 step 2 (corrected): escape angle brackets only inside indented code samples.
//
// MDX reads an indented line that starts with `<` as a tag, not as code. Escaping the bracket
// keeps the text and compiles — but only where the line belongs to a block that starts indented.
// A line indented under a column-0 HTML block (the Preview sections) is part of that tag tree
// and escaping it would leave the block unbalanced.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const INDENTED = /^(?: {4}|\t)/u;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const touched = [];

try {
  const [row] = await sql`select body_md from posts where id = 7`;
  const lines = row.body_md.split("\n");

  // Start from the unescaped form so a re-run converges instead of stacking backslashes.
  const plain = lines.map((line) => line.replaceAll("\\<", "<"));
  let fence = null;

  /**
   * A line indented under a column-0 HTML tag is part of that tag tree (the Preview sections);
   * anywhere else an indented line is a code sample, which is what has to be escaped.
   */
  const insideHtmlBlock = (index) => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const above = plain[cursor] ?? "";

      // Skip the block's own indented children: the block starts at the first column-0 line.
      if (above.trim() === "" || INDENTED.test(above)) continue;

      return /^<[A-Za-z]/u.test(above);
    }

    return false;
  };

  plain.forEach((line, index) => {
    const trimmed = line.trimStart();

    if (fence !== null) {
      if (trimmed.startsWith(fence)) fence = null;
      return;
    }

    if (trimmed.startsWith(CODE.repeat(3)) || trimmed.startsWith("~~~")) {
      fence = trimmed.slice(0, 3);
      return;
    }

    if (!INDENTED.test(line) || !line.includes("<") || line.includes(CODE)) return;
    if (insideHtmlBlock(index)) return;

    plain[index] = line.replaceAll("<", "\\<");
    touched.push(index + 1 + ': ' + plain[index].trim().slice(0, 90));
  });

  const body = plain.join("\n");

  writeFileSync("C:/dev/dsh/projects/hataraku/artifacts/h68/body-7.after.md", body);
  await sql`update posts set body_md = ${body}, updated_at = now() where id = 7`;
} finally {
  await sql.end({ timeout: 5 });
}

console.log(JSON.stringify({ count: touched.length, touched }, null, 2));
