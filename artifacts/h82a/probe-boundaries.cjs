
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const path = require("node:path");

const OUT = process.env.OUT_DIR;
const BASE = "http://127.0.0.1:3000";
const EXEC = process.env.CHROME_PATH;

const ROUTES = [
  ["blog", "/blog"],
  ["blog-segment", "/blog/39"],
  ["blog-archive", "/blog/archive"],
  ["blog-taxonomy", "/blog/taxonomy"],
  ["docs", "/docs"],
  ["docs-slug", "/docs/api"],
  ["notes", "/notes"],
  ["projects", "/projects"],
  ["albums", "/albums"],
  ["albums-segment", "/albums/1"],
  ["changelog", "/changelog"],
  ["toolbox", "/toolbox"],
  ["about", "/about"],
  ["search", "/search"],
];

const report = { routes: [], layouts: [], consoleErrors: [] };

const overflow = async (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

(async () => {
  const browser = await pw.chromium.launch({ executablePath: EXEC, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) => report.consoleErrors.push("pageerror: " + String(err).slice(0, 300)));

  for (const [key, route] of ROUTES) {
    const response = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 120000 });
    const status = response ? response.status() : null;
    const wide = await overflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    const narrow = await overflow(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    report.routes.push({ key, route, status, wide, narrow });
    console.log("route", route, status, "wide", wide.scrollWidth + "/" + wide.clientWidth, "narrow", narrow.scrollWidth + "/" + narrow.clientWidth);
  }

  // Loading blackout: Slow 4G, a lazy navigation after hydration.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 1500,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });

  const NAV = [
    ["blog", "写作", "/blog", "blog-loading"],
    ["archive", null, "/blog/archive", "archive-loading", "更多"],
    ["taxonomy", null, "/blog/taxonomy", "taxonomy-loading", "更多"],
    ["docs", "文档", "/docs", "docs-loading"],
    ["notes", null, "/notes", "notes-loading", "更多"],
    ["projects", "项目", "/projects", "projects-loading"],
    ["albums", "相册", "/albums", "albums-loading"],
  ];

  for (const entry of NAV) {
    const [key, barLabel, route] = entry;
    const moreLabel = entry[4];
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(300);
    try {
      if (moreLabel) {
        await page.getByText(moreLabel, { exact: true }).first().click({ timeout: 15000 });
        await page.getByRole("link", { name: barLabel || (key === "archive" ? "归档" : key === "taxonomy" ? "分类" : key === "notes" ? "微言" : "") }).first().click({ timeout: 15000 });
      } else {
        await page.getByRole("link", { name: barLabel }).first().click({ timeout: 15000 });
      }
    } catch (error) {
      report.layouts.push({ key, route, error: String(error).slice(0, 200) });
      console.log("nav failed", key, String(error).slice(0, 120));
      continue;
    }
    const seen = await page
      .waitForSelector('[data-slot="' + entry[3] + '"]', { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    const shotPath = path.join(OUT, "skeleton-" + key + "-1440.png");
    if (seen) await page.screenshot({ path: shotPath });
    report.layouts.push({ key, route, sawSkeleton: seen, screenshot: seen ? shotPath : null, at: page.url() });
    console.log("skeleton", key, seen);
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  }

  // 405
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const nf = await page.goto(BASE + "/nope", { waitUntil: "networkidle", timeout: 120000 });
  const nfStatus = nf ? nf.status() : null;
  const nfSeen = await page.locator('[data-slot="not-found"]').count();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(OUT, "not-found-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const nfNarrow = await overflow(page);
  await page.screenshot({ path: path.join(OUT, "not-found-390.png"), fullPage: true });
  report.notFound = { status: nfStatus, rendered: nfSeen > 0, narrow: nfNarrow };

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log("done");
})().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});
