// H68: find the first line that the MDX compiler cannot parse, in document context.
//
//   node artifacts/h68/diagnose.mjs <body.md>
//
// It compiles growing prefixes of the body with the same remark plugin the app uses, so the
// reported line is the first one that breaks a whole document, not just an isolated snippet.
import { readFileSync } from "node:fs";

const { compile } = await import("file:///C:/dev/dsh/projects/hataraku/node_modules/.pnpm/@mdx-js+mdx@3.1.1_supports-color@8.1.1/node_modules/@mdx-js/mdx/index.js");
const { default: remarkGfm } = await import("file:///C:/dev/dsh/projects/hataraku/node_modules/.pnpm/remark-gfm@4.0.1_supports-color@8.1.1/node_modules/remark-gfm/index.js");

const path = process.argv[2];
const body = readFileSync(path, "utf8");
const lines = body.split("\n");

const tryCompile = async (value) => {
  try {
    await compile(value, { remarkPlugins: [remarkGfm] });
    return null;
  } catch (error) {
    return String(error.message).split("\n")[0];
  }
};

let previousOk = true;
const failures = [];

for (let index = 0; index < lines.length; index += 1) {
  const prefix = lines.slice(0, index + 1).join("\n");
  const failure = await tryCompile(prefix);

  if (failure !== null && previousOk) {
    failures.push({ line: index + 1, reason: failure, text: lines[index].slice(0, 120) });
  }

  previousOk = failure === null;
}

console.log(JSON.stringify({ failures: failures.slice(0, 6), first: failures[0] ?? null }, null, 2));
