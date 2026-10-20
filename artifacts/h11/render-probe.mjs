// H11 render probe v4: measure what each composited layer actually contains.
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const store = "node_modules/.pnpm";
const packageDir = readdirSync(store).find((entry) => entry.startsWith("playwright-core@"));
const { chromium } = require(join(process.cwd(), store, packageDir, "node_modules", "playwright-core"));

const url = process.argv[2] ?? "http://localhost:3300/sheet-probe";

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { height: 1200, width: 1280 } });

await page.addInitScript(() => {
  const log = { layers: [], fillText: 0, texts: [] };
  window.__h11log = log;

  const twoD = CanvasRenderingContext2D.prototype;
  const originalFillText = twoD.fillText;
  twoD.fillText = function (text, ...rest) {
    log.fillText += 1;
    if (log.texts.length < 10) {
      log.texts.push(String(text).slice(0, 12));
    }
    return originalFillText.call(this, text, ...rest);
  };

  const originalDrawImage = twoD.drawImage;
  twoD.drawImage = function (source, ...rest) {
    if (log.layers.length < 12 && source instanceof HTMLCanvasElement) {
      let painted = 0;
      try {
        const context = source.getContext("2d");
        const data = context.getImageData(0, 0, Math.max(1, source.width), Math.max(1, source.height)).data;
        for (let index = 3; index < data.length; index += 4 * 37) {
          if (data[index] > 0) {
            painted += 1;
          }
        }
      } catch {
        painted = -1;
      }
      log.layers.push({ painted: painted * 37, size: [source.width, source.height] });
    }
    return originalDrawImage.call(this, source, ...rest);
  };
});

const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("[data-slot=sheet-probe] canvas", { state: "attached" });
await page.waitForTimeout(4000);

const result = await page.evaluate(() => ({ log: window.__h11log }));
console.log(JSON.stringify({ url, errors, result }, null, 2));
await browser.close();
