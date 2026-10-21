// Captures the three surfaces the design-system task compares, plus a geometry/style fingerprint of
// every visible element so "same pixels" can be checked as data, not only by eye. Texts are masked
// where they carry per-run values (the freshly created account email).
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE;
const prefix = process.env.SHOT_PREFIX ?? "shot";
const width = Number(process.env.SHOT_WIDTH ?? "1440");
const height = Number(process.env.SHOT_HEIGHT ?? "900");

const { chromium } = createRequire(
  path.join(
    repo,
    "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js"
  )
)("./index.js");

const shotsDir = path.join(here, "screenshots");
await mkdir(shotsDir, { recursive: true });

const mask = (text) =>
  text
    .replace(/h53-\d+@example\.com/gu, "<email>")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/gu, "<date>")
    .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/gu, "<date>")
    .replace(/\b\d+ (minutes?|hours?|days?) ago\b/gu, "<ago>");

const fingerprint = async (page) => {
  const nodes = await page.evaluate(() => {
    const records = [];
    const walk = (element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const style = getComputedStyle(element);
      records.push({
        classes: String(element.className).slice(0, 120),
        rect: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)],
        slot: element.getAttribute("data-slot"),
        styles: [
          style.backgroundColor,
          style.borderBottomColor,
          style.borderBottomLeftRadius,
          style.borderBottomWidth,
          style.color,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
          style.paddingBottom,
          style.paddingLeft,
          style.paddingTop,
          style.paddingRight,
        ].join("|"),
        tag: element.tagName,
        text: (element.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 60),
      });
      for (const child of element.children) walk(child);
    };
    if (document.body !== null) walk(document.body);
    return records;
  });
  return nodes.map((node) => ({ ...node, text: mask(node.text) }));
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();
const email = `h53-${Date.now()}@example.com`;

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Need an account? Sign up" }).click();
await page.getByLabel("Name").fill("Ada");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
await page.waitForURL("**/todos");

const all = {};
for (const entry of [
  { name: "home", path: "/" },
  { name: "article", path: "/article" },
  { name: "admin", path: "/settings/admin" },
]) {
  await page.goto(base + entry.path, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(shotsDir, `${prefix}-${entry.name}.png`),
    fullPage: true,
  });
  all[entry.name] = await fingerprint(page);
  console.log("shot", prefix, entry.name, entry.path, all[entry.name].length, "nodes");
}

await writeFile(
  path.join(here, `fingerprints-${prefix}.json`),
  JSON.stringify(all, null, 0) + "\n"
);
console.log("USER " + email);
await context.close();
await browser.close();