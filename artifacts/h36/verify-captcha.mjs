// Checks the forgot-password page under a captcha-enabled deployment: the widget renders, the
// submission carries its token, and the endpoint answers without CAPTCHA only to requests that skip
// it.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3000";
const expectCaptcha = process.env.H36_EXPECT_CAPTCHA === "1";
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

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1300 } });
  // The reset endpoint allows three requests a minute per address; each probe run presents its own
  // address so a rerun does not inherit the previous run's budget.
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
  });
  const page = await context.newPage();

  try {
    const seen = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/request-password-reset")) {
        seen.push(request.headers());
      }
    });

    await page.goto(base + "/forgot-password", { waitUntil: "domcontentloaded" });

    // Turnstile's hidden response input is what "a widget is mounted" looks like in the DOM; the
    // test site key answers with a token shortly after render.
    const responseInput = page.locator('input[name="cf-turnstile-response"]');
    let widgetToken = "";

    if (expectCaptcha) {
      await page.waitForFunction(
        () => {
          const input = document.querySelector(
            'input[name="cf-turnstile-response"]'
          );

          return input !== null && input.value !== "";
        },
        { timeout: 20000 }
      );
      widgetToken = await responseInput.inputValue();
    } else {
      await page.waitForTimeout(2000);
    }

    const widgetCount = await responseInput.count();
    check(
      expectCaptcha
        ? "the forgot-password form mounts the Turnstile widget and receives its token"
        : "without a site key the form renders no widget",
      expectCaptcha ? widgetCount === 1 && widgetToken !== "" : widgetCount === 0,
      expectCaptcha ? `token ${widgetToken.length} chars` : "no widget input"
    );

    await page.getByLabel("邮箱").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "发送重置邮件" }).click();
    await page.getByText("如果该地址已注册，我们已发送重置邮件。").waitFor({ state: "visible" });
    check("the form submits and shows the neutral answer", true, "200 + neutral message");

    const header = seen.at(-1)?.["x-captcha-response"] ?? "";
    check(
      expectCaptcha
        ? "the submission carried the captcha token"
        : "without a site key the submission carries no captcha header",
      expectCaptcha ? header !== "" : header === "",
      expectCaptcha ? (header === "" ? "missing" : "present") : "absent"
    );

    // The protection itself: a request that skips the widget must not pass when the deployment has
    // the secret.
    const direct = await fetch(base + "/api/auth/request-password-reset", {
      body: JSON.stringify({
        email: "nobody@example.com",
        redirectTo: base + "/reset-password",
      }),
      headers: {
        "content-type": "application/json",
        origin: base,
        // A fresh bucket: the endpoint allows three requests a minute per address, and this probe
        // may already have spent one through the form.
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      method: "POST",
    });
    const directBody = await direct.json();

    if (expectCaptcha) {
      check(
        "a request without a token is still refused",
        direct.status === 400 && directBody.code === "MISSING_RESPONSE",
        String(direct.status) + " " + String(directBody.code)
      );
    } else {
      check(
        "a request without a token passes when captcha is not configured",
        direct.status === 200,
        String(direct.status)
      );
    }

    if (expectCaptcha) {
      // The other protected endpoint's form: sign-in already mounts the widget, checked here so the
      // pair cannot drift apart again.
      await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => {
          const input = document.querySelector(
            'input[name="cf-turnstile-response"]'
          );

          return input !== null && input.value !== "";
        },
        { timeout: 20000 }
      );
      check(
        "the sign-in form mounts the same widget",
        (await page.locator('input[name="cf-turnstile-response"]').count()) === 1,
        "login widget mounted"
      );
    }

    await shot(page, expectCaptcha ? "forgot-with-captcha.png" : "forgot-without-captcha.png");
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(here, expectCaptcha ? "verification-captcha.json" : "verification-no-captcha.json"),
    JSON.stringify(
      { base, checkedAt: new Date().toISOString(), expectCaptcha, checks, screenshots },
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