// Reads the two exact values the token change must preserve: the compact button's font size and
// the checkbox's corner radius. The 599-node fingerprint proves nothing else moved; this proves the
// two targeted utilities still compute to 12.8px and 4px.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE;
const label = process.env.PROBE_LABEL ?? "run";

const { chromium } = createRequire(
  path.join(
    repo,
    "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js"
  )
)("./index.js");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Need an account? Sign up" }).click();
await page.getByLabel("Name").fill("Ada");
await page.getByLabel("Email").fill(`h57-${Date.now()}@example.com`);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
await page.waitForURL("**/todos");

// A todo brings a real checkbox into the DOM.
await page.getByLabel("New todo").fill("measure the corner");
await page.getByRole("main").getByRole("button", { name: "Add" }).click();
await page.waitForFunction(
  () => document.querySelectorAll('[data-slot="checkbox"]').length > 0
);

const todos = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('[data-slot="button"]')].map((element) => ({
    fontSize: getComputedStyle(element).fontSize,
    text: element.textContent?.trim().slice(0, 20),
  })),
  checkboxes: [...document.querySelectorAll('[data-slot="checkbox"]')].map((element) => ({
    borderRadius: getComputedStyle(element).borderRadius,
    height: getComputedStyle(element).height,
    width: getComputedStyle(element).width,
  })),
}));

// The compact button size is used on the admin lists.
await page.goto(base + "/settings/admin/posts", { waitUntil: "networkidle" });
const admin = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('[data-slot="button"]')].map((element) => ({
    fontSize: getComputedStyle(element).fontSize,
    text: element.textContent?.trim().slice(0, 20),
  })),
}));

const report = { label, todos, admin };
await mkdir(here, { recursive: true });
await writeFile(
  path.join(here, `style-probe-${label}.json`),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(JSON.stringify(report, null, 2));

await context.close();
await browser.close();
