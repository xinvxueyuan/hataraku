// H70: turn the six escaped indented samples in post 7 back into fenced code blocks.
//
// The samples are found by their escaped brackets, so a second run finds nothing to do. Inside a
// fence the brackets need no escape, and the indentation stays as written.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const FENCE = CODE.repeat(3);
const INDENTED = /^(?: {4}|\t)/u;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

/** Markdown syntax samples read as md; anything that is markup reads as html. */
const languageFor = (block) =>
  block.some((line) => /\[foo\]:|<http|<address@|\*\*/u.test(line)) ? "md" : "html";

try {
  const [row] = await sql`select body_md from posts where id = 7`;
  const lines = row.body_md.split("\n");

  const escaped = [];

  lines.forEach((line, index) => {
    if (line.includes("\\<")) escaped.push(index);
  });

  if (escaped.length === 0) {
    console.log(JSON.stringify({ note: "nothing to do: no escaped brackets left" }));
    process.exit(0);
  }

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

  const ranges = blocks.map((block) => {
    let start = block.start;
    let end = block.end;

    while (start > 0 && INDENTED.test(lines[start - 1] ?? "")) start -= 1;
    while (end < lines.length - 1 && INDENTED.test(lines[end + 1] ?? "")) end += 1;

    return { end, start };
  });

  const output = [];
  let cursor = 0;
  const summary = [];

  for (const range of ranges) {
    output.push(...lines.slice(cursor, range.start));

    const block = lines.slice(range.start, range.end + 1).map((line) => line.replaceAll("\\<", "<"));
    const language = languageFor(block);

    output.push(`${FENCE}${language}`, ...block, FENCE);
    summary.push({ end: range.end + 1, language, lines: block.length, start: range.start + 1 });
    cursor = range.end + 1;
  }

  output.push(...lines.slice(cursor));

  const body = output.join("\n");

  writeFileSync("C:/dev/dsh/projects/hataraku/artifacts/h70/body-7.after.md", body);
  await sql`update posts set body_md = ${body}, updated_at = now() where id = 7`;

  console.log(JSON.stringify({ blocks: summary, escapedLines: escaped.length, total: summary.length }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
