
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const path = require("node:path");
const BASE = process.env.BASE_URL;
const OUT = process.env.OUT_DIR;
const report = { items: [] };

const watch = async (page, slot) => {
  await page.evaluate((slot) => {
    window.__h82a = { appeared: null };
    window.__h82a.poll = setInterval(() => {
      if (window.__h82a.appeared === null && document.querySelector('[data-slot="' + slot + '"]')) {
        window.__h82a.appeared = Math.round(performance.now());
      }
    }, 20);
  }, slot);
};

const readSeen = (page) =>
  page.evaluate(() => (window.__h82a ? window.__h82a.appeared : null)).catch(() => null);

const shoot = async (page, name) => {
  const shot = path.join(OUT, name);
  await page.screenshot({ path: shot });
  return shot;
};

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 1500, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8,
  });

  // 390: navigate with the skeleton under a phone viewport and measure overflow while it is up.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [key, label, slot] of [["projects", "项目", "projects-loading"], ["blog", "写作", "blog-loading"]]) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.locator("details summary").first().waitFor({ state: "visible", timeout: 60000 });
    await page.locator("details summary").first().click({ timeout: 60000 });
    await page.waitForTimeout(250);
    await watch(page, slot);
    await page.getByRole("link", { name: label, exact: true }).first().click({ timeout: 15000, noWaitAfter: true });
    let shot = null;
    const metrics = [];
    for (let tick = 0; tick < 220; tick += 1) {
      await page.waitForTimeout(50);
      const seen = await readSeen(page);
      if (seen !== null) {
        metrics.push(
          await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }))
        );
        shot = await shoot(page, "skeleton-" + key + "-390.png");
        break;
      }
    }
    report.items.push({ key: key + "-390", metrics, shot });
    console.log("nav390", key, JSON.stringify(metrics), shot);
  }

  // Error boundary: a page that throws must show app/error.tsx (the probe route exists only for this run).
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  for (const [width, name] of [[1440, "error-1440.png"], [390, "error-390.png"]]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const response = await page.goto(BASE + "/h82a-throws", { waitUntil: "networkidle" });
    const shown = await page.locator('[data-slot="error-boundary"]').count();
    const text = await page.locator("main").innerText().catch(() => "");
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const full = path.join(OUT, name);
    await page.screenshot({ path: full, fullPage: true });
    report.items.push({ key: "error-" + width, status: response ? response.status() : null, shown, text: text.slice(0, 200), metrics, shot: full });
    console.log("error", width, response ? response.status() : null, shown, JSON.stringify(metrics));
  }

  // Global error: the client-side boundary the root layout failure would render.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const globalRendered = await page.evaluate(() => {
    const error = new Error("probe");
    error.digest = "1234567890";
    return { error: error.message, digest: error.digest };
  });
  report.globalErrorDigestSample = globalRendered;
  console.log("digest sample", JSON.stringify(globalRendered));

  report.notFound390 = await (async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/nope", { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    return { metrics, shot: await shoot(page, "not-found-390-verify.png") };
  })();
  console.log("404/390", JSON.stringify(report.notFound390));

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report-more.json"), JSON.stringify(report, null, 2));
  console.log("done");
})().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});