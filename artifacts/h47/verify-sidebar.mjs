// Verifies the settings sidebar: the nine pages, the three widths, the sticky column and the four
// ways the narrow-screen drawer closes. Measurements are scoped to the admin shell: two navs exist
// in the DOM (desktop column and drawer panel) and only one is visible at a time.
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

const shot = async (page, name, fullPage = true) => {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage });
  screenshots.push(name);
};

const PAGES = [
  { label: "总览", path: "/settings/admin" },
  { label: "文章", path: "/settings/admin/posts" },
  { label: "微言", path: "/settings/admin/micro" },
  { label: "项目", path: "/settings/admin/projects" },
  { label: "更新日志", path: "/settings/admin/changelog" },
  { label: "站点", path: "/settings/admin/profile" },
  { label: "安全", path: "/settings/security" },
  { label: "两步验证", path: "/settings/two-factor" },
  { label: "密码", path: "/settings/password" },
];

const SHELL = '[data-slot="admin-shell"]';
const VISIBLE_NAV = `${SHELL} nav[aria-label="设置"]:visible`;

const overflow = async (page) =>
  await page.evaluate(() => ({
    equal: document.documentElement.scrollWidth === window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

/** The visible nav's box, or null when the column is collapsed. */
const visibleNavBox = async (page) =>
  await page.evaluate((selector) => {
    const navs = [...document.querySelectorAll(selector + ' nav[aria-label="设置"]')];
    const nav = navs.find((element) => element.getBoundingClientRect().width > 0) ?? null;

    if (nav === null) return null;

    const box = nav.getBoundingClientRect();

    return {
      left: Math.round(box.left),
      top: Math.round(box.top),
      width: Math.round(box.width),
      bottom: Math.round(box.bottom),
    };
  }, SHELL);

const drawerOpen = async (page) =>
  await page.evaluate(
    (selector) => document.querySelector(selector + " details")?.open === true,
    SHELL
  );

const openDrawer = async (page) => {
  const summary = page.locator(`${SHELL} details summary`);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await summary.click();
    await page.waitForTimeout(250);

    if (await drawerOpen(page)) {
      return;
    }
  }

  throw new Error("the settings drawer did not open");
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const email = `sidebar-${Date.now()}@example.com`;

  try {
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/todos");

    // Desktop: every page has the left column, marks itself, and stays inside the viewport.
    for (const entry of PAGES) {
      await page.goto(base + entry.path, { waitUntil: "networkidle" });
      const nav = page.locator(VISIBLE_NAV);
      const links = nav.locator("a");
      const current = nav.locator('[aria-current="page"]');
      const shape = await visibleNavBox(page);
      const content = await page.evaluate(
        (selector) =>
          Math.round(
            document
              .querySelector(selector + ' [data-slot="admin-content"]')
              ?.getBoundingClientRect().left ?? 0
          ),
        SHELL
      );
      const room = await overflow(page);

      check(
        `${entry.path} shows the left column with nine links`,
        (await links.count()) === 9 && shape !== null && shape.width >= 150 && shape.left < content,
        `nav left ${shape?.left} width ${shape?.width} < content left ${content}`
      );
      check(
        `${entry.path} marks exactly one current section`,
        (await current.count()) === 1 && (await current.innerText()) === entry.label,
        String(await current.first().innerText().catch(() => ""))
      );
      check(
        `${entry.path} does not overflow horizontally`,
        room.equal,
        `scrollWidth ${room.scrollWidth} / viewport ${room.viewport}`
      );
    }

    // Reading measure at 1440: the content column, unchanged by the sidebar.
    await page.goto(base + "/settings/admin/profile", { waitUntil: "networkidle" });
    const measure = await page.evaluate((selector) => ({
      content: Math.round(
        document
          .querySelector(selector + ' [data-slot="admin-content"]')
          ?.getBoundingClientRect().width ?? 0
      ),
      shell: Math.round(
        document.querySelector(selector)?.getBoundingClientRect().width ?? 0
      ),
    }), SHELL);
    check(
      "the content column keeps its reading measure at 1440",
      measure.content >= 620 && measure.content <= 700,
      `content ${measure.content}px (before: 640), shell ${measure.shell}px`
    );
    await shot(page, "sidebar-1440.png");

    // 1024 keeps the column.
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto(base + "/settings/security", { waitUntil: "networkidle" });
    const at1024 = await visibleNavBox(page);
    check(
      "1024 keeps the sidebar",
      at1024 !== null && at1024.width >= 150,
      JSON.stringify(at1024)
    );
    check("1024 does not overflow", (await overflow(page)).equal, "scrollWidth === innerWidth");
    await shot(page, "sidebar-1024.png");

    // Sticky: a short viewport forces scrolling; the column stays near the top.
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto(base + "/settings/security", { waitUntil: "networkidle" });
    const pageShape = await page.evaluate(() => ({
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    await page.evaluate(() => window.scrollTo(0, 260));
    await page.waitForTimeout(400);
    const afterScroll = await visibleNavBox(page);
    const scrollY = await page.evaluate(() => Math.round(window.scrollY));
    check(
      "the sidebar stays visible while the page scrolls",
      pageShape.scrollHeight > pageShape.innerHeight &&
        scrollY > 0 &&
        afterScroll !== null &&
        afterScroll.top > 0 &&
        afterScroll.top < 160 &&
        afterScroll.bottom > 0,
      JSON.stringify({ scrollY, pageShape, afterScroll })
    );
    await shot(page, "sidebar-sticky.png", false);

    // 390: the column collapses into a disclosure; four closing paths.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/settings/security", { waitUntil: "networkidle" });
    const visibleNavs = await page.locator(VISIBLE_NAV).count();
    const summaryVisible = await page.evaluate((selector) => {
      const summary = document.querySelector(selector + " details summary");
      return summary !== null && summary.getBoundingClientRect().width > 0;
    }, SHELL);
    check(
      "390 collapses the column into a disclosure",
      visibleNavs === 0 && summaryVisible,
      JSON.stringify({ visibleNavs, summaryVisible })
    );
    check("390 does not overflow", (await overflow(page)).equal, "scrollWidth === innerWidth");

    await openDrawer(page);
    check(
      "opening the drawer shows the same nine links",
      (await page.locator(`${SHELL} details[open] nav a`).count()) === 9,
      "9 links"
    );
    await shot(page, "drawer-390-open.png", false);

    await page.mouse.click(200, 600);
    await page.waitForTimeout(250);
    check("a pointerdown outside closes the drawer", !(await drawerOpen(page)), "closed");

    await openDrawer(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const afterEscape = await page.evaluate((selector) => ({
      closed: document.querySelector(selector + " details")?.open !== true,
      focus: document.activeElement?.tagName ?? "",
    }), SHELL);
    check(
      "Escape closes the drawer and returns focus to the summary",
      afterEscape.closed && afterEscape.focus === "SUMMARY",
      JSON.stringify(afterEscape)
    );

    await openDrawer(page);
    await page.locator(`${SHELL} details[open] nav a`, { hasText: "文章" }).click();
    await page.waitForURL("**/settings/admin/posts");
    check("a link inside the drawer closes it", !(await drawerOpen(page)), "closed");

    // A route change with no pointerdown: keyboard activation of a link on the page.
    await page.goto(base + "/settings/security", { waitUntil: "networkidle" });
    await openDrawer(page);
    await page.evaluate(() => {
      document.querySelector('main a[href="/settings/two-factor"]')?.focus();
    });
    await page.keyboard.press("Enter");
    await page.waitForURL("**/settings/two-factor");
    check(
      "a route change starts the drawer closed",
      !(await drawerOpen(page)),
      "closed on the next route"
    );
    await shot(page, "sidebar-390.png");
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(here, "verification.json"),
    JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, screenshots }, null, 2) + "\n"
  );
  console.log(checks.length - failures.length + "/" + checks.length + " checks passed");
  if (failures.length > 0) {
    console.log("failed: " + failures.join(", "));
    process.exitCode = 1;
  }
};

await main();
