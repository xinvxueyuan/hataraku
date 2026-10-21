// Narrow-width checks for the settings shell: 390px, and the effective viewport of a 200% zoom
// (195px), plus 320/360 midpoints. Every width must keep scrollWidth === innerWidth and must let the
// drawer open with its nine links inside the viewport.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE;
const shotsDir = path.join(here, "screenshots");

const { chromium } = createRequire(
  path.join(
    repo,
    "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js"
  )
)("./index.js");

const checks = [];
const failures = [];
const screenshots = [];
const check = (name, passed, detail) => {
  checks.push({ name, passed, detail });
  console.log((passed ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!passed) failures.push(name);
};

const SHELL = '[data-slot="admin-shell"]';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await mkdir(shotsDir, { recursive: true });

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Need an account? Sign up" }).click();
await page.getByLabel("Name").fill("Ada");
await page.getByLabel("Email").fill(`narrow-${Date.now()}@example.com`);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
await page.waitForURL("**/todos");

for (const width of [390, 360, 320, 195]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(base + "/settings/security", { waitUntil: "networkidle" });

  const before = await page.evaluate((selector) => {
    const summary = document.querySelector(selector + " details summary");
    const box = summary?.getBoundingClientRect();
    return {
      equal: document.documentElement.scrollWidth === window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      summaryInside: box !== undefined && box.left >= 0 && box.right <= window.innerWidth + 0.5,
      viewport: window.innerWidth,
    };
  }, SHELL);
  check(
    width + "px: no horizontal overflow with the column collapsed",
    before.equal && before.summaryInside,
    JSON.stringify(before)
  );

  await page.locator(SHELL + " details summary").click();
  await page.waitForTimeout(300);
  const opened = await page.evaluate((selector) => {
    const details = document.querySelector(selector + " details");
    const panel = details?.querySelector("div");
    const box = panel?.getBoundingClientRect();
    return {
      links: details?.querySelectorAll("nav a").length ?? 0,
      open: details?.open === true,
      panelInside: box !== undefined && box.left >= -0.5 && box.right <= window.innerWidth + 0.5,
      equal: document.documentElement.scrollWidth === window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  }, SHELL);
  check(
    width + "px: the open drawer keeps nine links inside the viewport",
    opened.open &&
      opened.links === 9 &&
      opened.panelInside &&
      opened.equal,
    JSON.stringify(opened)
  );

  if (width === 390 || width === 195) {
    const name = "narrow-" + width + ".png";
    await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
    screenshots.push(name);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

await writeFile(
  path.join(here, "verification-narrow.json"),
  JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, screenshots }, null, 2) + "\n"
);
console.log(checks.length - failures.length + "/" + checks.length + " checks passed");
if (failures.length > 0) {
  console.log("failed: " + failures.join(", "));
  process.exitCode = 1;
}
await context.close();
await browser.close();
