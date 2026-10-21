// Walks every settings page as the owner and checks that the section navigation is present, marks
// the current page, and fits a 390px screen.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3000";
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
  if (!passed) {
    failures.push(name);
  }
};

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  screenshots.push(name);
};

const SECTIONS = [
  { label: "总览", path: "/settings/admin", title: "写作后台" },
  { label: "文章", path: "/settings/admin/posts", title: "文章" },
  { label: "微言", path: "/settings/admin/micro", title: "微言" },
  { label: "项目", path: "/settings/admin/projects", title: "项目" },
  { label: "更新日志", path: "/settings/admin/changelog", title: "更新日志" },
  { label: "站点", path: "/settings/admin/profile", title: "站点资料" },
  { label: "安全", path: "/settings/security", title: "安全概览" },
  { label: "两步验证", path: "/settings/two-factor", title: "Two-factor authentication" },
  { label: "密码", path: "/settings/password", title: "修改密码" },
];

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page = await context.newPage();
  const email = `shell-${Date.now()}@example.com`;

  try {
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/todos");

    for (const section of SECTIONS) {
      await page.goto(base + section.path, { waitUntil: "domcontentloaded" });
      const nav = page.locator('nav[aria-label="设置"]');
      const links = nav.locator("a");
      const count = await links.count();
      const current = page.locator('nav[aria-label="设置"] [aria-current="page"]');
      const heading = await page.locator("main h1").first().innerText();

      check(
        `${section.path} shows the settings navigation`,
        count === SECTIONS.length,
        count + " links"
      );
      check(
        `${section.path} marks 当前页`,
        (await current.count()) === 1 &&
          (await current.innerText()) === section.label,
        String(await current.first().innerText().catch(() => ""))
      );
      check(
        `${section.path} keeps its heading`,
        heading.includes(section.title),
        heading
      );
    }

    // The two pages the report was about, side by side with the navigation in place.
    await page.goto(base + "/settings/security", { waitUntil: "domcontentloaded" });
    await shot(page, "security-with-nav.png");
    await page.goto(base + "/settings/two-factor", { waitUntil: "domcontentloaded" });
    await shot(page, "two-factor-with-nav.png");

    // 390px on the signed-in page: the navigation wraps, nothing overflows the viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/settings/security", { waitUntil: "domcontentloaded" });
    const layout = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="设置"]');
      const links = [...(nav?.querySelectorAll("a") ?? [])];
      const boxes = links.map((link) => link.getBoundingClientRect());

      return {
        current: document.querySelector('nav[aria-label="设置"] [aria-current="page"]')?.textContent ?? null,
        navOverflow: (nav?.scrollWidth ?? 0) > (nav?.clientWidth ?? 0) + 1,
        pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        outside: boxes.filter((box) => box.left < -0.5 || box.right > window.innerWidth + 0.5).length,
        rows: new Set(boxes.map((box) => Math.round(box.top))).size,
      };
    });
    check(
      "the 390px navigation wraps inside the viewport",
      !layout.navOverflow && !layout.pageOverflow && layout.outside === 0 && layout.rows > 1,
      JSON.stringify(layout)
    );
    check(
      "the 390px page still marks the current section",
      layout.current === "安全",
      String(layout.current)
    );
    await shot(page, "security-390.png");
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(here, "verification.json"),
    JSON.stringify(
      { base, checkedAt: new Date().toISOString(), checks, screenshots },
      null,
      2
    ) + "\n"
  );

  console.log(checks.length - failures.length + "/" + checks.length + " checks passed");
  if (failures.length > 0) {
    console.log("failed: " + failures.join(", "));
    process.exitCode = 1;
  }
};

await main();