
const pw = require(process.env.PW_CORE);
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const OUT = process.env.OUT_DIR;
const BASE = "http://127.0.0.1:3000";
const EXEC = process.env.CHROME_PATH;

const NAV = [
  ["blog", "写作", "/blog", "blog-loading"],
  ["archive", "归档", "/blog/archive", "archive-loading"],
  ["taxonomy", "分类", "/blog/taxonomy", "taxonomy-loading"],
  ["docs", "文档", "/docs", "docs-loading"],
  ["notes", "微言", "/notes", "notes-loading"],
  ["projects", "项目", "/projects", "projects-loading"],
  ["albums", "相册", "/albums", "albums-loading"],
];

const report = { stream: [], navigations: [] };

// Read the raw body in order, recording the offset of the skeleton marker and of the resolved page.
const streamOrder = (route) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    http
      .get(BASE + route, (res) => {
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          let offset = 0;
          let skeletonAt = -1;
          let endAt = -1;
          for (const chunk of chunks) {
            const text = chunk.toString("utf8");
            if (skeletonAt === -1 && text.includes('data-slot="' ) && /loading"/.test(text)) skeletonAt = offset;
            if (endAt === -1 && text.includes("$RC")) endAt = offset;
            offset += chunk.length;
          }
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode,
            bytes: body.length,
            hasSkeleton: /data-slot="[a-z-]+-loading"/.test(body),
            skeletonBeforeResolve: skeletonAt !== -1 && (endAt === -1 || skeletonAt <= endAt),
            chunkCount: chunks.length,
          });
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });

(async () => {
  for (const [key, , route] of NAV) {
    const order = await streamOrder(route);
    report.stream.push({ key, route, ...order });
    console.log("stream", key, JSON.stringify(order));
  }

  const browser = await pw.chromium.launch({ executablePath: EXEC, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 1500, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8,
  });

  for (const [key, label, route, slot] of NAV) {
    await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(400);

    // Arm an in-page watcher, then click from Node so the navigation cannot destroy the evaluate context.
    await page.evaluate((slot) => {
      window.__h82a = { appeared: null };
      const probe = () => {
        if (window.__h82a.appeared === null && document.querySelector('[data-slot="' + slot + '"]')) {
          window.__h82a.appeared = Math.round(performance.now());
        }
      };
      window.__h82a.poll = setInterval(probe, 20);
      probe();
    }, slot);

    const clicked = await page
      .getByRole("link", { name: label, exact: true })
      .first()
      .click({ timeout: 15000, noWaitAfter: true })
      .then(() => true)
      .catch((error) => String(error).slice(0, 150));

    let appeared = null;
    let shot = null;
    for (let tick = 0; tick < 160; tick += 1) {
      await page.waitForTimeout(50);
      appeared = await page
        .evaluate(() => {
          try {
            return window.__h82a ? window.__h82a.appeared : null;
          } catch {
            return null;
          }
        })
        .catch(() => null);
      if (appeared !== null) {
        shot = path.join(OUT, "skeleton-" + key + "-1440.png");
        await page.screenshot({ path: shot }).catch(() => {});
        break;
      }
      const done = await page.evaluate(() => document.readyState === "complete" && !!document.querySelector("main")).catch(() => false);
      if (done && tick > 20) break;
    }

    await page.evaluate(() => {
      if (window.__h82a && window.__h82a.poll) clearInterval(window.__h82a.poll);
    }).catch(() => {});

    const landed = page.url();
    report.navigations.push({ key, route, clicked, appeared, landed, screenshot: shot });
    console.log("client nav", key, "clicked", clicked, "appeared", appeared, "landed", landed);
  }

  // 390 check while a skeleton is up: navigate to /projects on a phone viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__h82a = { appeared: null };
    window.__h82a.poll = setInterval(() => {
      const node = document.querySelector('[data-slot="projects-loading"]');
      if (window.__h82a.appeared === null && node) window.__h82a.appeared = true;
    }, 20);
  });
  await page.getByRole("link", { name: "项目", exact: true }).first().click({ timeout: 15000, noWaitAfter: true }).catch(() => {});
  let narrowShot = null;
  for (let tick = 0; tick < 160; tick += 1) {
    await page.waitForTimeout(50);
    const seen = await page.evaluate(() => (window.__h82a ? window.__h82a.appeared : null)).catch(() => null);
    if (seen) {
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      narrowShot = path.join(OUT, "skeleton-projects-390.png");
      await page.screenshot({ path: narrowShot });
      report.narrowSkeleton = { ...metrics, screenshot: narrowShot };
      break;
    }
    const done = await page.evaluate(() => document.readyState === "complete").catch(() => false);
    if (done && tick > 20) break;
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "stream-report.json"), JSON.stringify(report, null, 2));
  console.log("done");
})().catch((error) => {
  console.error("FATAL", error);
  process.exit(1);
});
