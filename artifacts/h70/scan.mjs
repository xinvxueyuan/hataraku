// H70 scan: every indented line that starts a tag, split by whether MDX misreads it.
//
// `problematic` lines are indented and not inside a column-0 HTML block, so MDX parses them as
// JSX instead of code. `htmlBlockChildren` are indented children of a real HTML block, which is
// valid JSX and is left alone.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const INDENTED = /^(?: {4}|\t)/u;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const maskInline = (line) => {
  const chars = [...line];

  for (let index = 0; index < chars.length; index += 1) {
    if (chars[index] !== CODE) continue;
    let closing = index + 1;
    while (closing < chars.length && chars[closing] !== CODE) closing += 1;
    if (closing >= chars.length) break;
    for (let cursor = index; cursor <= closing; cursor += 1) chars[cursor] = " ";
    index = closing;
  }

  return chars.join("");
};

const report = [];

try {
  const posts = await sql`select id, title, body_md from posts order by id`;

  for (const post of posts) {
    const lines = post.body_md.split("\n");
    let fence = null;
    const htmlBlockChildren = [];
    const problematic = [];

    const insideHtmlBlock = (index) => {
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const above = lines[cursor] ?? "";

        if (above.trim() === "" || INDENTED.test(above)) continue;

        return /^<[A-Za-z]/u.test(above);
      }

      return false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trimStart();

      if (fence !== null) {
        if (trimmed.startsWith(fence)) fence = null;
        return;
      }

      if (trimmed.startsWith(CODE.repeat(3)) || trimmed.startsWith("~~~")) {
        fence = trimmed.slice(0, 3);
        return;
      }

      if (!INDENTED.test(line)) return;

      const bare = maskInline(line);
      let position = -1;

      for (let cursor = 0; cursor < bare.length; cursor += 1) {
        if (bare[cursor] !== "<") continue;
        if (line[cursor - 1] === "\\") continue;

        position = cursor;
        break;
      }

      if (position === -1) return;

      const entry = { line: index + 1, text: line.trim().slice(0, 60) };

      if (insideHtmlBlock(index)) htmlBlockChildren.push(entry);
      else problematic.push(entry);
    });

    if (problematic.length > 0 || htmlBlockChildren.length > 0) {
      report.push({ htmlBlockChildren, id: post.id, problematic, title: post.title });
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}

writeFileSync("C:/dev/dsh/projects/hataraku/artifacts/h70/scan.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((entry) => ({
  htmlBlockChildren: entry.htmlBlockChildren.length,
  id: entry.id,
  problematic: entry.problematic.length,
  title: entry.title,
})), null, 2));
