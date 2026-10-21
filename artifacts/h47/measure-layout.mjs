// Measures the settings page's layout at the requested width. Used twice: against the old
// horizontal shell (before) and the new sidebar (after), so the reading measure can be compared.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE;
const width = Number(process.env.MEASURE_WIDTH ?? "1440");
const height = Number(process.env.MEASURE_HEIGHT ?? "900");
const label = process.env.MEASURE_LABEL ?? "run";
const outFile = process.env.MEASURE_OUT;
const shotFile = path.join(here, "screenshots", "layout-" + label + "-" + width + ".png");

const { chromium } = createRequire(
  path.join(
    repo,
    "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js"
  )
)("./index.js");

await mkdir(path.dirname(shotFile), { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();
const email = `layout-${Date.now()}@example.com`;

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Need an account? Sign up" }).click();
await page.getByLabel("Name").fill("Ada");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
await page.waitForURL("**/todos");

await page.goto(base + "/settings/admin/profile", { waitUntil: "networkidle" });

const metrics = await page.evaluate(() => {
  const main = document.querySelector("main");
  const heading = main?.querySelector("h1") ?? null;
  const section = main?.querySelector("section") ?? null;
  const nav = main?.querySelector('nav[aria-label="设置"]') ?? null;

  const box = (element) => {
    if (element === null) return null;
    const rect = element.getBoundingClientRect();
    return { left: Math.round(rect.left), width: Math.round(rect.width) };
  };

  return {
    heading: box(heading),
    mainWidth: box(main),
    navDisplay: nav === null ? "absent" : getComputedStyle(nav).display,
    navLinks: nav?.querySelectorAll("a").length ?? 0,
    noHorizontalOverflow: document.documentElement.scrollWidth === window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    sectionWidth: box(section),
    viewport: window.innerWidth,
  };
});

await page.screenshot({ path: shotFile, fullPage: true });
await writeFile(
  outFile,
  JSON.stringify({ base, label, width, metrics, shot: shotFile }, null, 2) + "\n"
);
console.log(JSON.stringify(metrics, null, 2));

await context.close();
await browser.close();