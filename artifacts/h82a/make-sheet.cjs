
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const path = require("node:path");
const OUT = process.env.OUT_DIR;
const files = ["skeleton-blog-1440.png","skeleton-archive-1440.png","skeleton-taxonomy-1440.png","skeleton-docs-1440.png","skeleton-notes-1440.png","skeleton-projects-1440.png","skeleton-albums-1440.png","skeleton-projects-390.png"];

(async () => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const cells = files
    .map((file) => {
      const full = path.join(OUT, file);
      if (!fs.existsSync(full)) return "";
      const data = "data:image/png;base64," + fs.readFileSync(full).toString("base64");
      const label = file.replace("skeleton-", "").replace(".png", "");
      return '<figure><img src="' + data + '"><figcaption>' + label + "</figcaption></figure>";
    })
    .join("");
  const html =
    '<html><body style="margin:0;background:#f6f6f7;font:13px system-ui">' +
    '<h1 style="font:600 15px system-ui;padding:12px 16px;margin:0">H82a · Slow 4G navigation: captured loading skeletons (1440, last one 390)</h1>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 16px">' + cells + "</div>" +
    "<style>figure{margin:0;background:#fff}img{width:100%;display:block}figcaption{padding:4px 6px;color:#555}</style>" +
    "</body></html>";
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "skeletons-contact-sheet.png"), fullPage: true });
  console.log("sheet written");
  await browser.close();
})().catch((error) => { console.error("FATAL", String(error).slice(0, 200)); process.exit(1); });
