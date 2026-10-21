// H70: compile the whole body with the same compiler and plugins the app uses.
import { readFileSync } from "node:fs";

const base = "C:/dev/dsh/projects/hataraku/node_modules/.pnpm";
const mdx = `${base}/@mdx-js+mdx@3.1.1_supports-color@8.1.1/node_modules/@mdx-js/mdx/index.js`;
const gfm = `${base}/remark-gfm@4.0.1_supports-color@8.1.1/node_modules/remark-gfm/index.js`;

const { compile } = await import(`file:///${mdx}`);
const { default: remarkGfm } = await import(`file:///${gfm}`);

const body = readFileSync(process.argv[2], "utf8");

try {
  await compile(body, { remarkPlugins: [remarkGfm] });
  console.log("compiled: ok, length " + body.length);
} catch (error) {
  console.log("failed: " + String(error.message).split("\n").slice(0, 3).join(" | "));
  process.exitCode = 1;
}
