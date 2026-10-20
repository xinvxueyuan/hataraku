// Drives a real Chromium through the two-factor enrolment journey against a running stack.
// It measures the rendered QR SVG (box size, module sub-paths, and the exact module matrix) instead
// of only asserting that an element exists, and it keeps screenshots as evidence.
//
// Run it with the stack on 3310/3311:
//   node artifacts/h12/verify-two-factor.mjs
// The secret is never printed: only its length and whether it matches the issued otpauth URI.
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3310";
const email = "probe-" + Date.now() + "@example.com";
const password = "probe-password-1";
const shotsDir = path.join(here, "screenshots");

const lazy = (file, specifier) => createRequire(path.join(repo, file))(specifier);

const { chromium } = lazy(
  "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js",
  "./index.js"
);
const qrcode = lazy(
  "node_modules/.pnpm/qrcode-generator@2.0.4/node_modules/qrcode-generator/dist/qrcode.js",
  "./qrcode.js"
);

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

const base32Decode = (input) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of input.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index === -1) {
      throw new Error("not base32: " + character);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const totp = (secret, at) => {
  const counter = Math.floor((at ?? Date.now()) / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    1_000_000;
  return code.toString().padStart(6, "0");
};

// The module matrix react-qr-code draws, rebuilt from the same generator so the rendered
// path can be compared command for command.
const expectedMatrix = (uri) => {
  const matrix = qrcode(0, "M");
  matrix.addData(uri);
  matrix.make();
  const count = matrix.getModuleCount();
  const rows = [];
  for (let row = 0; row < count; row += 1) {
    const cells = [];
    for (let column = 0; column < count; column += 1) {
      cells.push(
        matrix.isDark(row, column)
          ? "M " + column + " " + row + " l 1 0 0 1 -1 0 Z"
          : ""
      );
    }
    rows.push(cells.join(" "));
  }
  return { count, path: rows.join(" ") };
};

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
  screenshots.push(name);
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });
  let qrMetrics = {};
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1400 },
  });
  const page = await context.newPage();

  try {
    // An anonymous visitor is sent to sign in, and the login page returns here afterwards.
    await page.goto(base + "/settings/two-factor", { waitUntil: "networkidle" });
    check(
      "the page is protected",
      decodeURIComponent(page.url()).endsWith("/login?redirect=/settings/two-factor"),
      page.url()
    );

    // Sign up through the UI so the browser holds a real session cookie.
    await page.getByRole("button", { name: "Need an account? Sign up" }).click();
    await page.getByLabel("Name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("main").getByRole("button", { name: "Sign up" }).click();
    await page.waitForURL("**/settings/two-factor");
    check("sign up returns to the requested page", true, page.url());
    check(
      "the signed-in page offers enrolment",
      await page
        .getByRole("button", { name: "Set up an authenticator app" })
        .isVisible(),
      page.url()
    );

    // Start enrolment and capture the response the page received.
    await page.getByLabel("Password").fill(password);
    const enableResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/two-factor/enable") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Set up an authenticator app" }).click();
    const enabled = await enableResponse;
    const body = await enabled.json();

    check(
      "enable answers 200 with a totp URI",
      enabled.status() === 200 &&
        typeof body.totpURI === "string" &&
        body.totpURI.startsWith("otpauth://totp/"),
      String(enabled.status()) + " " + String(body.totpURI).slice(0, 28) + "…"
    );
    check(
      "enable returns ten backup codes",
      Array.isArray(body.backupCodes) && body.backupCodes.length === 10,
      String(body.backupCodes?.length) + " codes"
    );

    const qr = page.locator('[data-testid="totp-qr"] svg');
    await qr.waitFor({ state: "visible" });
    qrMetrics = await qr.evaluate((svg) => {
      const box = svg.getBoundingClientRect();
      const paths = Array.from(svg.querySelectorAll("path"));
      const foreground = paths.length > 1 ? paths[1].getAttribute("d") : "";
      const background = paths.length > 0 ? paths[0].getAttribute("d") : "";
      return {
        width: box.width,
        height: box.height,
        viewBox: svg.getAttribute("viewBox"),
        heightAttribute: svg.getAttribute("height"),
        widthAttribute: svg.getAttribute("width"),
        pathCount: paths.length,
        subpaths: ((foreground ?? "").match(/M /g) ?? []).length,
        backgroundSubpaths: ((background ?? "").match(/M /g) ?? []).length,
        foreground: foreground ?? "",
        title: svg.querySelector("title")?.textContent ?? null,
      };
    });

    check(
      "the QR SVG has a rendered box",
      qrMetrics.width >= 128 && qrMetrics.height >= 128,
      qrMetrics.width + "x" + qrMetrics.height + " css px"
    );
    check(
      "the QR SVG carries both paths",
      qrMetrics.pathCount === 2 &&
        qrMetrics.subpaths > 50 &&
        qrMetrics.backgroundSubpaths > 50,
      qrMetrics.pathCount +
        " paths, " +
        qrMetrics.subpaths +
        " dark modules, " +
        qrMetrics.backgroundSubpaths +
        " light modules"
    );

    const expected = expectedMatrix(body.totpURI);
    check(
      "the QR module grid matches the issued otpauth URI",
      qrMetrics.foreground === expected.path &&
        qrMetrics.viewBox ===
          "0 0 " + expected.count + " " + expected.count,
      "viewBox " + String(qrMetrics.viewBox) + ", expected " + expected.count + " modules"
    );

    const secret = (await page.locator('[data-testid="totp-secret"]').textContent()) ?? "";
    const uriSecret = new URL(body.totpURI).searchParams.get("secret") ?? "";
    check(
      "the manual key is the base32 key from the URI",
      secret.length > 0 && secret === uriSecret && /^[A-Z2-7]+=*$/.test(secret),
      "length " + secret.length + ", matches URI: " + (secret === uriSecret)
    );

    const shownCodes = await page.locator('[data-testid="backup-codes"] li').allTextContents();
    check(
      "ten backup codes are shown and they are the issued ones",
      shownCodes.length === 10 &&
        shownCodes.join(",") === body.backupCodes.join(","),
      shownCodes.length + " shown"
    );
    check(
      "the page says each backup code works once",
      (await page.getByText("Each code works once").count()) === 1,
      "one-time-use note present"
    );

    const submit = page.getByRole("button", {
      name: "Turn on two-factor authentication",
    });
    await page.getByLabel("Authentication code").fill(totp(secret));
    check(
      "verification waits for the backup codes to be acknowledged",
      await submit.isDisabled(),
      "button disabled"
    );
    await page
      .getByRole("checkbox", { name: "I have saved these backup codes" })
      .click();
    check(
      "acknowledging the backup codes unlocks verification",
      !(await submit.isDisabled()),
      "button enabled"
    );

    await shot(page, "01-enrollment-qr.png");

    // A wrong code has to say why it failed.
    await page.getByLabel("Authentication code").fill("000000");
    await submit.click();
    const alert = page.locator("form").getByRole("alert");
    await alert.waitFor({ state: "visible" });
    const alertText = (await alert.textContent()) ?? "";
    check(
      "a wrong code reports the reason",
      alertText.toLowerCase().includes("invalid code"),
      alertText.trim()
    );
    await shot(page, "02-invalid-code.png");

    // /two-factor/* allows three requests per ten seconds; let the window roll before verifying.
    await page.waitForTimeout(11_500);
    await page.getByLabel("Authentication code").fill(totp(secret));
    await submit.click();
    await page
      .getByText("Two-factor authentication is on.", { exact: true })
      .waitFor({ state: "visible" });
    check("the right code turns two-factor on", true, "status shown");
    await shot(page, "03-enabled.png");

    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      return response.json();
    });
    check(
      "the session reports twoFactorEnabled",
      session?.user?.twoFactorEnabled === true,
      "twoFactorEnabled=" + String(session?.user?.twoFactorEnabled)
    );

    await page.reload({ waitUntil: "networkidle" });
    check(
      "the enrolled state survives a reload",
      await page
        .getByRole("button", { name: "Disable two-factor authentication" })
        .isVisible(),
      page.url()
    );
    await shot(page, "04-enabled-after-reload.png");

    // Sign out and back in: the second factor is now enforced.
    await page.getByRole("button", { name: "Ada" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(base + "/");

    await page.goto(base + "/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
    await page.getByLabel("Authentication code").waitFor({ state: "visible" });
    check("signing in asks for the second factor", true, "challenge shown");
    await shot(page, "05-signin-challenge.png");

    await page.getByLabel("Authentication code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL("**/todos");
    check("the second factor completes sign-in", true, page.url());
    await shot(page, "06-signed-in-with-2fa.png");

    // Disabling takes a second confirmation.
    await page.goto(base + "/settings/two-factor", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Disable two-factor authentication" })
      .click();
    check(
      "disabling asks for a second confirmation",
      await page.getByText("Disable two-factor authentication?").isVisible(),
      "confirmation panel shown"
    );
    await shot(page, "07-disable-confirmation.png");

    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Yes, disable it" }).click();
    await page
      .getByText("Two-factor authentication is off.", { exact: true })
      .waitFor({ state: "visible" });
    check("disabling turns two-factor off", true, "status shown");
    await shot(page, "08-disabled.png");

    const after = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      return response.json();
    });
    check(
      "the session reports twoFactorEnabled false",
      after?.user?.twoFactorEnabled === false,
      "twoFactorEnabled=" + String(after?.user?.twoFactorEnabled)
    );

    await page.getByRole("button", { name: "Ada" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(base + "/");
    await page.goto(base + "/login", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/todos");
    check(
      "signing in no longer asks for the second factor",
      (await page.getByLabel("Authentication code").count()) === 0,
      page.url()
    );
    await shot(page, "09-signed-in-without-2fa.png");
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
        qr: {
          height: qrMetrics.height,
          pathCount: qrMetrics.pathCount,
          subpaths: qrMetrics.subpaths,
          width: qrMetrics.width,
          viewBox: qrMetrics.viewBox,
        },
        screenshots,
      },
      null,
      2
    ) + "\n"
  );

  console.log(
    checks.length - failures.length + "/" + checks.length + " checks passed"
  );
  if (failures.length > 0) {
    console.log("failed: " + failures.join(", "));
    process.exitCode = 1;
  }
};

await main();
