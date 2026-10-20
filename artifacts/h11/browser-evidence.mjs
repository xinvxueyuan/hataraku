// H11 evidence: open the docs page in a real Chromium and prove the sheet painted.
//
// The MCP browser this session drives reports document.visibilityState "hidden", so it never runs
// requestAnimationFrame — and Univer draws on rAF. This script launches its own headless Chromium,
// where rAF runs, waits for the embed, and asserts on the canvas the page actually painted.
//
// Run from the repo root: node artifacts/h11/browser-evidence.mjs [url] [png]
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const store = "node_modules/.pnpm";
const packageDir = readdirSync(store).find((entry) => entry.startsWith("playwright-core@"));

if (packageDir === undefined) {
  throw new Error("playwright-core is not installed in this workspace's pnpm store");
}

const { chromium } = require(join(process.cwd(), store, packageDir, "node_modules", "playwright-core"));

const url = process.argv[2] ?? "http://localhost:3300/docs/embedded-sheet";
const output = process.argv[3] ?? "artifacts/h11/embed-browser.png";
// A stock Chrome or Edge binary can be pointed at with H11_BROWSER_EXE, so the same assertion runs
// against a browser this repository does not ship as well as Playwright's own build.
const executablePath = process.env.H11_BROWSER_EXE;

const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { height: 1200, width: 1280 } });
const errors = [];

page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  // Not "networkidle": the dev server keeps a socket open, so the page never goes idle. The canvas
  // selector and the painted-pixel poll below are the real readiness signal.
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // The node has to be attached, not visible: the preset also renders a 0x0 helper canvas, and the
  // size is the assertion below rather than a precondition here.
  await page.waitForSelector("[data-slot=sheet-canvas] canvas", {
    state: "attached",
    timeout: 60_000,
  });

  const read = () =>
    page.evaluate(() => {
      const host = document.querySelector("[data-slot=sheet-canvas]");

      if (host === null) {
        return { canvases: [], pointerEvents: null, visibility: document.visibilityState };
      }

      const canvases = [...host.querySelectorAll("canvas")].map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const context = canvas.getContext("2d");
        let painted = 0;

        if (context !== null && canvas.width > 0) {
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

          for (let index = 3; index < data.length; index += 4) {
            if (data[index] > 0) {
              painted += 1;
            }
          }
        }

        return {
          buffer: [canvas.width, canvas.height],
          drawn: painted,
          size: [Math.round(rect.width), Math.round(rect.height)],
        };
      });

      return {
        canvases,
        pointerEvents: getComputedStyle(host).pointerEvents,
        visibility: document.visibilityState,
      };
    });

  let state = await read();

  // A hidden page never runs rAF, so wait for a painted frame in the visible one instead of
  // assuming a fixed delay is enough for a ~2 MB engine plus fonts.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (state.canvases.some((canvas) => canvas.drawn > 0)) {
      break;
    }

    await page.waitForTimeout(500);
    state = await read();
  }

  const sized = state.canvases.filter((canvas) => canvas.size[0] > 0 && canvas.size[1] > 0);
  const painted = state.canvases.filter((canvas) => canvas.drawn > 0);

  await page.locator("[data-slot=sheet-embed]").scrollIntoViewIfNeeded();
  await page.locator("[data-slot=sheet-embed]").screenshot({ path: output });

  const verdict = {
    canvases: state.canvases,
    errors,
    output,
    paintedCanvases: painted.length,
    pointerEvents: state.pointerEvents,
    sizedCanvases: sized.length,
    url,
    visibility: state.visibility,
  };

  console.log(JSON.stringify(verdict, null, 2));

  if (sized.length === 0 || painted.length === 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
