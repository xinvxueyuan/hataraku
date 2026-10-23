
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const path = require("node:path");
const BASE = process.env.BASE_URL;
const OUT = process.env.OUT_DIR;

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const captured = {};

  page.on("response", async (response) => {
    const request = response.request();
    const headers = request.headers();
    const url = response.url();
    if (headers["rsc"] === "1" || url.includes("_rsc=")) {
      try {
        captured[url] = {
          status: response.status(),
          headers: await response.allHeaders(),
          body: (await response.text()).slice(0, 4000),
        };
      } catch (error) {
        captured[url] = { error: String(error) };
      }
    }
  });

  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("link", { name: "写作", exact: true }).first().click({ noWaitAfter: true });
  await page.waitForTimeout(6000);
  fs.writeFileSync(path.join(OUT, "rsc-capture.json"), JSON.stringify(captured, null, 2));
  for (const [url, value] of Object.entries(captured)) {
    console.log("RSC", url.slice(0, 120), value.status, "len", value.body ? value.body.length : 0);
    console.log((value.body || "").slice(0, 700).replace(/\n/g, "\\n"));
  }
  await browser.close();
})().catch((error) => { console.error("FATAL", String(error).slice(0, 300)); process.exit(1); });
