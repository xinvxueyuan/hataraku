// Completes the password reset a reader would complete: the token comes from the email Resend
// delivered (recorded by send-real-reset.mjs), and the flow runs in a real Chromium.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3000";
const linkFile = process.env.H33_LINK_FILE;
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

const EMAIL = "xinvxueyuan@yeah.net";
const INITIAL_PASSWORD = "initial-horse-battery";
const NEW_PASSWORD = "reset-horse-battery-2026";

const main = async () => {
  await mkdir(shotsDir, { recursive: true });

  if (!linkFile) {
    throw new Error("H33_LINK_FILE is required");
  }

  const { link, token } = JSON.parse(await readFile(linkFile, "utf8"));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1200 } });
  const page = await context.newPage();

  try {
    // The entry point on the sign-in form.
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    const forgot = page.getByRole("link", { name: "忘记密码？" });
    check(
      "the sign-in form links to the reset request",
      (await forgot.getAttribute("href")) === "/forgot-password",
      String(await forgot.getAttribute("href"))
    );

    // An address nobody registered gets the same answer as a registered one.
    await page.goto(base + "/forgot-password", { waitUntil: "domcontentloaded" });
    await page.getByLabel("邮箱").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "发送重置邮件" }).click();
    const neutral = page.getByText("如果该地址已注册，我们已发送重置邮件。");
    await neutral.waitFor({ state: "visible" });
    check("an unknown address gets the neutral answer", true, "same message shown");
    await shot(page, "forgot-password.png");

    // The link exactly as Resend delivered it: Better Auth validates the token, then redirects to
    // the callback page this app owns.
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/reset-password**");
    console.log("email link landed on:", page.url().replace(token, "<token>"));
    await page.getByLabel("新密码", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("再输一次新密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "设置新密码" }).click();
    await page.getByText("密码已重置").waitFor({ state: "visible" });
    check("the emailed token sets a new password", true, `token from ${new URL(link).origin}`);
    await shot(page, "reset-done.png");

    // The new password signs in.
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/todos");
    check("the new password signs in", true, page.url());
    await shot(page, "signed-in-after-reset.png");

    // Put the account back where it was: current = new, next = the original.
    await page.goto(base + "/settings/password", { waitUntil: "domcontentloaded" });
    await page.getByLabel("当前密码").fill(NEW_PASSWORD);
    await page.getByLabel("新密码", { exact: true }).fill(INITIAL_PASSWORD);
    await page.getByLabel("再输一次新密码").fill(INITIAL_PASSWORD);
    await page.getByRole("button", { name: "更新密码" }).click();
    await page.getByText("密码已更新。").waitFor({ state: "visible" });

    await page.getByRole("button", { name: "站长" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(base + "/");

    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password").fill(INITIAL_PASSWORD);
    await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/todos");
    check("the original password is restored", true, page.url());

    // A token that was never issued gets a readable card, not a 500. The page cannot know the token
    // is bad until the server answers, so the card appears after the first submit.
    await page.goto(base + "/reset-password?token=not-a-real-token", {
      waitUntil: "domcontentloaded",
    });
    await page.getByLabel("新密码", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("再输一次新密码").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "设置新密码" }).click();
    await page.getByText("链接无法使用").waitFor({ state: "visible" });
    check(
      "an unusable token renders a readable card with a way to ask again",
      (await page.getByRole("link", { name: "忘记密码" }).count()) === 1,
      "链接无法使用 + 忘记密码 link"
    );
    await shot(page, "invalid-token.png");

    // The callback's error redirect lands on the same card.
    await page.goto(base + "/reset-password?error=INVALID_TOKEN", {
      waitUntil: "domcontentloaded",
    });
    check(
      "the callback's error redirect renders the same card",
      (await page.getByText("链接无法使用").count()) === 1,
      "?error=INVALID_TOKEN"
    );
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(here, "verification.json"),
    JSON.stringify(
      {
        base,
        checkedAt: new Date().toISOString(),
        checks,
        emailLink: { origin: new URL(link).origin, path: new URL(link).pathname.replace(token, "<token>") },
        productionEmail: process.env.H33_PROD_LINK_FILE
          ? await readFile(process.env.H33_PROD_LINK_FILE, "utf8").then((raw) => {
              const prod = JSON.parse(raw);
              return { origin: new URL(prod.link).origin, messageId: prod.messageId };
            })
          : null,
        screenshots,
      },
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