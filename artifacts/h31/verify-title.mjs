// Drives a real Chromium through the site profile and reads what the document actually reports:
// the <title> element, the Open Graph title, and the canonical/og:url that metadataBase resolves.
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

/** What the browser's document says about itself right now. */
const head = async (page) => {
  await page.waitForLoadState("domcontentloaded");

  return await page.evaluate(() => ({
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    ogTitle:
      document.querySelector('meta[property="og:title"]')?.getAttribute(
        "content"
      ) ?? null,
    ogUrl:
      document.querySelector('meta[property="og:url"]')?.getAttribute(
        "content"
      ) ?? null,
    title: document.title,
    twitterTitle:
      document.querySelector('meta[name="twitter:title"]')?.getAttribute(
        "content"
      ) ?? null,
  }));
};

const email = `title-${Date.now()}@example.com`;
const ORIGINAL = { name: "夜行栈", nameEn: "NightStack" };
const CHANGED = { name: "夜行栈 · H31" };

const openProfile = async (page) => {
  await page.goto(base + "/settings/admin/profile", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "站点资料" }).waitFor();
};

const saveName = async (page, name) => {
  await page.getByLabel("站点名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "保存站点资料" }).click();
  await page.getByText("站点资料已保存。").waitFor({ state: "visible" });
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1400 },
  });
  const page = await context.newPage();

  try {
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/todos");

    // The editor is reachable from the settings navigation.
    await openProfile(page);
    const navLink = page.getByRole("link", { name: "站点" });
    check(
      "the settings navigation links to the profile editor",
      (await navLink.getAttribute("href")) === "/settings/admin/profile",
      String(await navLink.getAttribute("href"))
    );

    // Store the site's own name through the profile editor.
    await page.getByLabel("站点名", { exact: true }).fill(ORIGINAL.name);
    await page.getByLabel("站点名（英文）").fill(ORIGINAL.nameEn);
    await page.getByRole("button", { name: "保存站点资料" }).click();
    await page.getByText("站点资料已保存。").waitFor({ state: "visible" });

    const home = await (async () => {
      await page.goto(base + "/", { waitUntil: "domcontentloaded" });

      return await head(page);
    })();
    check(
      "the home tab title is the profile name",
      home.title === `${ORIGINAL.name} ${ORIGINAL.nameEn}`,
      home.title
    );
    check(
      "the home og:title matches the tab title",
      home.ogTitle === home.title && home.twitterTitle === home.title,
      `og=${home.ogTitle} twitter=${home.twitterTitle}`
    );
    // `url: "./"` on the root resolves to the origin; Next normalizes the trailing slash away,
    // so accept both spellings rather than pinning a cosmetic difference.
    check(
      "metadataBase still resolves canonical and og:url",
      home.canonical === base + "/" &&
        (home.ogUrl === base || home.ogUrl === base + "/"),
      `canonical=${home.canonical} og:url=${home.ogUrl}`
    );
    await shot(page, "home-title.png");

    await page.goto(base + "/archive", { waitUntil: "domcontentloaded" });
    const archive = await head(page);
    check(
      "a list page keeps the title template",
      archive.title === `归档 · ${ORIGINAL.name}`,
      archive.title
    );
    check(
      "a list page resolves its own canonical",
      archive.canonical === base + "/archive" &&
        archive.ogUrl === base + "/archive",
      `canonical=${archive.canonical}`
    );

    // Rename the site; the tab and og:title must follow without a rebuild.
    await openProfile(page);
    await saveName(page, CHANGED.name);

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const changed = await head(page);
    check(
      "a renamed site reaches the home tab title",
      changed.title === `${CHANGED.name} ${ORIGINAL.nameEn}`,
      changed.title
    );
    check(
      "the renamed site reaches the home og:title",
      changed.ogTitle === changed.title,
      `og=${changed.ogTitle}`
    );
    await shot(page, "home-changed-title.png");

    await page.goto(base + "/archive", { waitUntil: "domcontentloaded" });
    const changedArchive = await head(page);
    check(
      "the list page template uses the renamed site",
      changedArchive.title === `归档 · ${CHANGED.name}`,
      changedArchive.title
    );

    // Restore the name and confirm the title comes back.
    await openProfile(page);
    await saveName(page, ORIGINAL.name);

    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const restored = await head(page);
    check(
      "restoring the name restores the tab title",
      restored.title === `${ORIGINAL.name} ${ORIGINAL.nameEn}`,
      restored.title
    );
    await page.goto(base + "/archive", { waitUntil: "domcontentloaded" });
    check(
      "restoring the name restores the list page template",
      (await head(page)).title === `归档 · ${ORIGINAL.name}`,
      `归档 · ${ORIGINAL.name}`
    );
    await shot(page, "home-restored-title.png");
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