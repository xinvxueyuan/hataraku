// H70: print the indented sample blocks around every escaped bracket in post 7.
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const INDENTED = /^(?: {4}|\t)/u;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [row] = await sql`select body_md from posts where id = 7`;
  const lines = row.body_md.split("\n");

  const escaped = [];

  lines.forEach((line, index) => {
    if (line.includes("\\<")) escaped.push(index);
  });

  const blocks = [];
  let current = null;

  for (const index of escaped) {
    if (current !== null && index - current.end <= 2) {
      current.end = index;
      continue;
    }

    if (current !== null) blocks.push(current);
    current = { end: index, start: index };
  }

  if (current !== null) blocks.push(current);

  const report = blocks.map((block) => {
    let start = block.start;
    let end = block.end;

    while (start > 0 && INDENTED.test(lines[start - 1] ?? "")) start -= 1;
    while (end < lines.length - 1 && INDENTED.test(lines[end + 1] ?? "")) end += 1;

    return {
      end: end + 1,
      start: start + 1,
      text: lines.slice(start, end + 1),
    };
  });

  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
