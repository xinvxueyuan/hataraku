// Drives a real Chromium through the profile editor and checks that the home page, the footer and
// the about page read what was saved — then restores the values and checks them again.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3302";
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

const email = `profile-${Date.now()}@example.com`;
const ORIGINAL = {
  author: "xinvStar",
  description: "夜行栈：把代码、学习与生活编排成一片可阅读的个人星图。",
  email: "xinvxueyuan@yeah.net",
  github: "https://github.com/xinvstar",
  heroTitle: "夜行栈",
  name: "夜行栈",
  nameEn: "NightStack",
  tagline: "昼 · 清醒记录构建 / 夜 · 沉浸漫游沉思",
};
const CHANGED = {
  name: "夜行栈 · H29",
  tagline: "H29 联动验证副标题",
};

const fillProfile = async (page, values) => {
  await page.getByLabel("站点名", { exact: true }).fill(values.name);
  await page.getByLabel("站点名（英文）").fill(values.nameEn ?? "");
  await page.getByLabel("副标题").fill(values.tagline);
  await page.getByLabel("站点描述").fill(values.description ?? "");
  await page.getByLabel("作者").fill(values.author ?? "");
  await page.getByLabel("联系邮箱").fill(values.email ?? "");
  await page.getByLabel("GitHub").fill(values.github ?? "");
  await page.getByLabel("主标题").fill(values.heroTitle ?? "");
};

const save = async (page) => {
  await page.getByRole("button", { name: "保存站点资料" }).click();
  await page.getByText("站点资料已保存。").waitFor({ state: "visible" });
};

const openProfile = async (page) => {
  await page.goto(base + "/settings/admin/posts", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "站点" }).click();
  await page.waitForURL("**/settings/admin/profile");
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();

  try {
    // An account to write with.
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/todos");
    check("the writing account is created", true, page.url());

    // The entry point lives in the settings navigation.
    await page.goto(base + "/settings/admin/posts", { waitUntil: "domcontentloaded" });
    const link = page.getByRole("link", { name: "站点" });
    check(
      "the settings navigation links to the profile editor",
      (await link.getAttribute("href")) === "/settings/admin/profile",
      String(await link.getAttribute("href"))
    );
    await link.click();
    await page.waitForURL("**/settings/admin/profile");
    check("the profile editor opens from the navigation", true, page.url());

    // A fresh database has no row yet: fill everything and save.
    await fillProfile(page, ORIGINAL);
    await save(page);
    check("the profile is saved", true, "站点资料已保存。");
    await shot(page, "profile-form.png");

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const brand = await page.locator("header a").first().innerText();
    const heading = await page.locator("main h1").innerText();
    const footerText = await page.locator("footer").innerText();
    check(
      "the home page and the header show the saved name",
      heading.includes(ORIGINAL.name) && brand.includes(ORIGINAL.name),
      heading + " / " + brand
    );
    check(
      "the home page shows the saved tagline",
      (await page.getByText(ORIGINAL.tagline).count()) > 0,
      ORIGINAL.tagline
    );
    check(
      "the footer shows the saved name and description",
      footerText.includes(`${ORIGINAL.name} ${ORIGINAL.nameEn}`) &&
        footerText.includes(ORIGINAL.description),
      footerText.split("\n")[0]
    );
    await shot(page, "home-after-save.png");

    await page.goto(base + "/about", { waitUntil: "domcontentloaded" });
    const github = page.getByRole("link", { name: "GitHub" });
    check(
      "the about page shows the saved social link",
      (await github.getAttribute("href")) === ORIGINAL.github,
      String(await github.getAttribute("href"))
    );
    await shot(page, "about-after-save.png");

    // Change the name and the tagline; both must show up without a redeploy.
    await openProfile(page);
    await page.getByLabel("站点名", { exact: true }).fill(CHANGED.name);
    await page.getByLabel("副标题").fill(CHANGED.tagline);
    await save(page);

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const changedHeading = await page.locator("main h1").innerText();
    const changedFooter = await page.locator("footer").innerText();
    check(
      "a changed name reaches the home heading and the footer",
      changedHeading.includes(CHANGED.name) && changedFooter.includes(CHANGED.name),
      changedHeading
    );
    check(
      "a changed tagline reaches the home page",
      (await page.getByText(CHANGED.tagline).count()) > 0,
      CHANGED.tagline
    );
    await shot(page, "home-after-change.png");

    // Clearing a social link removes it from the about page.
    await openProfile(page);
    await page.getByLabel("GitHub").fill("");
    await save(page);
    await page.goto(base + "/about", { waitUntil: "domcontentloaded" });
    check(
      "clearing a social link removes it from the about page",
      (await page.getByRole("link", { name: "GitHub" }).count()) === 0,
      "no GitHub link"
    );

    // Restore the values the site shipped with.
    await openProfile(page);
    await page.getByLabel("站点名", { exact: true }).fill(ORIGINAL.name);
    await page.getByLabel("副标题").fill(ORIGINAL.tagline);
    await page.getByLabel("GitHub").fill(ORIGINAL.github);
    await save(page);

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const restoredHeading = await page.locator("main h1").innerText();
    const restoredFooter = await page.locator("footer").innerText();
    check(
      "the original name is restored on the home page and the footer",
      restoredHeading.includes(ORIGINAL.name) &&
        !restoredHeading.includes("H29") &&
        restoredFooter.includes(`${ORIGINAL.name} ${ORIGINAL.nameEn}`),
      restoredHeading
    );
    check(
      "the original tagline is restored",
      (await page.getByText(ORIGINAL.tagline).count()) > 0,
      ORIGINAL.tagline
    );
    await page.goto(base + "/about", { waitUntil: "domcontentloaded" });
    check(
      "the social link is restored on the about page",
      (await page.getByRole("link", { name: "GitHub" }).count()) === 1,
      ORIGINAL.github
    );
    await shot(page, "home-restored.png");
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
