// H70 evidence: how many code blocks the article renders, before and after the fences.
//
// It swaps the H68 body in, counts, swaps the H70 body back, counts, and leaves the H70 body
// stored either way.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join("C:/dev/dsh/projects/hataraku/packages/db", "package.json"));
const postgres = require("postgres");

const before = readFileSync("C:/dev/dsh/projects/hataraku/artifacts/h68/body-7.after.md", "utf8");
const after = readFileSync("C:/dev/dsh/projects/hataraku/artifacts/h70/body-7.after.md", "utf8");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const count = (html) => ({
  paragraphsWithTag: (html.match(/<p>[^<]*&lt;\/?[a-z]/gu) ?? []).length,
  pre: (html.match(/<pre/gu) ?? []).length,
});

const fetchPage = async () => {
  const response = await fetch("http://localhost:3300/blog/7");

  return { html: await response.text(), status: response.status };
};

try {
  await sql`update posts set body_md = ${before} where id = 7`;
  const first = await fetchPage();

  await sql`update posts set body_md = ${after} where id = 7`;
  const second = await fetchPage();

  console.log(JSON.stringify({
    after: { ...count(second.html), status: second.status },
    before: { ...count(first.html), status: first.status },
    sampleInsideCode: /<pre[\s\S]{0,400}&lt;div class=&quot;footer&quot;/u.test(second.html),
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
