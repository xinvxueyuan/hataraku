// H70 follow-up: the inline-HTML sample reads better highlighted as html than as md.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const CODE = String.fromCodePoint(96);
const FENCE = CODE.repeat(3);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [row] = await sql`select body_md from posts where id = 7`;
  const lines = row.body_md.split("\n");

  const anchor = lines.findIndex((line) => line.includes("<span>**Work**</span>"));

  if (anchor === -1) throw new Error("the inline-HTML sample is not where it was");

  let opening = anchor;

  while (opening > 0 && !(lines[opening] ?? "").startsWith(FENCE)) opening -= 1;

  if (lines[opening] !== `${FENCE}md`) {
    throw new Error(`expected an md fence above the sample, found: ${String(lines[opening])}`);
  }

  lines[opening] = `${FENCE}html`;

  const body = lines.join("\n");

  writeFileSync("C:/dev/dsh/projects/hataraku/artifacts/h70/body-7.after.md", body);
  await sql`update posts set body_md = ${body}, updated_at = now() where id = 7`;
  console.log(JSON.stringify({ fenceLine: opening + 1, language: "html" }));
} finally {
  await sql.end({ timeout: 5 });
}
