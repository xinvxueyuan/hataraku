
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const BASE = process.env.BASE_URL;
const OUT = process.env.OUT_DIR;
const ROUTES = ["/blog","/blog/39","/blog/archive","/blog/taxonomy","/docs","/docs/api","/notes","/projects","/albums","/albums/1","/changelog","/toolbox","/about","/search","/nope"];
const report = { routes: [] };

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const route of ROUTES) {
    const response = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    report.routes.push({ route, status: response ? response.status() : null, ...metrics });
    console.log(route, response ? response.status() : null, metrics.scrollWidth + "/" + metrics.clientWidth);
  }
  // 1440 pass for the same set.
  const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const widePage = await wide.newPage();
  for (const route of ROUTES) {
    const response = await widePage.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
    const metrics = await widePage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    console.log("1440", route, response ? response.status() : null, metrics.scrollWidth + "/" + metrics.clientWidth);
    if (metrics.scrollWidth !== metrics.clientWidth) console.log("OVERFLOW", route);
  }
  await browser.close();
  fs.writeFileSync(require("node:path").join(OUT, "report-final.json"), JSON.stringify(report, null, 2));
})().catch((error) => { console.error("FATAL", String(error).slice(0, 300)); process.exit(1); });
