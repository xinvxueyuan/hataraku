// Drives a real Chromium through sign-up, sign-in, the password page, sign-out and the two
// sign-ins that prove the old password stopped working and the new one started working.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3300";
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

const email = `password-${Date.now()}@example.com`;
const INITIAL_PASSWORD = "initial-horse-battery";
const NEW_PASSWORD = "correct-horse-battery-staple";

const signIn = async (page, password) => {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
};

const signOut = async (page) => {
  await page.getByRole("button", { name: "Ada" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(base + "/");
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1400 } });

  // The sign-in rule allows five attempts per client address per fifteen minutes. A probe run makes
  // three sign-ins, so each run presents its own forwarded address instead of inheriting the one the
  // previous run already spent.
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });
  const page = await context.newPage();

  try {
    // An account to change the password of.
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(INITIAL_PASSWORD);
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/todos");
    check("the account is created", true, page.url());

    await signOut(page);
    await signIn(page, INITIAL_PASSWORD);
    await page.waitForURL("**/todos");
    check("the initial password signs in", true, page.url());

    // The entry point: the admin navigation (shared by the settings surfaces) links to the page.
    await page.goto(base + "/settings/admin/posts", { waitUntil: "domcontentloaded" });
    const link = page.getByRole("link", { name: "密码" });
    check(
      "the settings navigation links to the password page",
      (await link.getAttribute("href")) === "/settings/password",
      String(await link.getAttribute("href"))
    );
    await link.click();
    await page.waitForURL("**/settings/password");
    check("the password page opens from the navigation", true, page.url());
    await shot(page, "password-form.png");

    // A wrong current password is explained, not shown as a code.
    await page.getByLabel("当前密码").fill("not-the-password");
    await page.getByLabel("新密码", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("再输一次新密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "更新密码" }).click();
    // Scope to the form: Next's route announcer is a role=alert element carrying the page title.
    const wrongCurrent = page.locator("form").getByRole("alert");
    await wrongCurrent.waitFor({ state: "visible" });
    const wrongText = (await wrongCurrent.textContent()) ?? "";
    check(
      "a wrong current password is explained",
      wrongText.includes("当前密码不正确"),
      wrongText.trim()
    );
    await shot(page, "wrong-current-password.png");

    // The real change.
    await page.getByLabel("当前密码").fill(INITIAL_PASSWORD);
    await page.getByLabel("新密码", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("再输一次新密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "更新密码" }).click();
    const updated = page.getByText("密码已更新。下次登录请使用新密码。");
    await updated.waitFor({ state: "visible" });
    check("a correct change is confirmed", true, "success message shown");
    await shot(page, "password-updated.png");

    await signOut(page);

    // The old password is dead. The auth form reports a failed sign-in through the app's global
    // mutation handler, which raises a toast outside <main>.
    await signIn(page, INITIAL_PASSWORD);
    const rejected = page.getByText("Invalid email or password");
    await rejected.waitFor({ state: "visible" });
    check(
      "the old password no longer signs in",
      page.url().includes("/login") && (await rejected.isVisible()),
      page.url() + " | toast visible"
    );
    await shot(page, "old-password-rejected.png");

    // …and the new one works.
    await signIn(page, NEW_PASSWORD);
    await page.waitForURL("**/todos");
    check("the new password signs in", true, page.url());
    await shot(page, "new-password-signed-in.png");

    // The page is for the signed-in account only; a visitor without a session is sent to sign in.
    const fresh = await browser.newContext();
    const visitor = await fresh.newPage();
    await visitor.goto(base + "/settings/password", {
      waitUntil: "domcontentloaded",
    });
    check(
      "a visitor without a session is sent to sign in",
      visitor.url().includes("/login") &&
        visitor.url().includes("redirect=%2Fsettings%2Fpassword"),
      visitor.url()
    );
    await fresh.close();
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