// Drives a real Chromium through a successful sign-in and a failed one, then reads the security
// page as the site owner and as another account. The audit rows come from the running web app.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3370";
const cookieFile = process.env.H21_COOKIE_FILE;
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

const OWNER = "owner@h21.test";
const OTHER = "other@h21.test";
const PASSWORD = "correct-horse-battery";

const main = async () => {
  await mkdir(shotsDir, { recursive: true });

  if (cookieFile === undefined || cookieFile === "") {
    throw new Error("H21_COOKIE_FILE is not set");
  }

  const cookies = JSON.parse(await readFile(cookieFile, "utf8"));
  const browser = await chromium.launch();
  const observations = {};

  try {
    // The owner signs in through the form: one successful sign-in, audited by the running app.
    const ownerContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    await owner.goto(base + "/login", { waitUntil: "networkidle" });
    await owner.getByLabel("Email").fill(OWNER);
    await owner.getByLabel("Password").fill(PASSWORD);
    await owner.getByRole("main").getByRole("button", { name: "Sign in" }).click();
    await owner.waitForURL("**/todos");
    check("the owner signs in through the form", true, owner.url());

    // One failed sign-in against the same endpoint.
    const failed = await owner.evaluate(async (email) => {
      const response = await fetch("/api/auth/sign-in/email", {
        body: JSON.stringify({ email, password: "wrong-password" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return response.status;
    }, OWNER);
    check(
      "a wrong password is refused",
      failed === 401,
      "status " + String(failed)
    );

    await owner.goto(base + "/settings/security", { waitUntil: "networkidle" });
    const rows = owner.locator('[data-slot="attempt-list"] li');
    const rowTexts = await rows.allTextContents();
    observations.ownerRows = rowTexts;
    check(
      "the owner sees both attempts on the security page",
      rowTexts.length >= 2 &&
        rowTexts.some((text) => text.includes("成功")) &&
        rowTexts.some((text) => text.includes("凭据无效")),
      rowTexts.length + " rows: " + rowTexts.map((text) => text.split(" ")[0]).join(", ")
    );
    const digestVisible = rowTexts.some((text) => /IP 摘要 [0-9a-f]{12}/u.test(text));
    observations.digestVisible = digestVisible;
    check(
      "the rows carry the truncated IP digest",
      digestVisible,
      rowTexts.find((text) => text.includes("IP 摘要")) ?? "no digest row"
    );
    await shot(owner, "owner-login-attempts.png");
    await ownerContext.close();

    // Another account still sees nothing: the attempt list is deployment-wide audit data.
    const otherContext = await browser.newContext();
    const otherCookie = cookies[OTHER];

    if (otherCookie === undefined) {
      throw new Error("no stored cookie for " + OTHER);
    }

    await otherContext.addCookies([
      {
        domain: "localhost",
        name: otherCookie.name,
        path: "/",
        value: otherCookie.value,
      },
    ]);
    const other = await otherContext.newPage();
    await other.goto(base + "/settings/security", { waitUntil: "networkidle" });
    const otherRows = await other.locator('[data-slot="attempt-list"] li').count();
    check(
      "another account sees no attempt rows",
      otherRows === 0 &&
        (await other.getByText("成功", { exact: true }).count()) === 0 &&
        (await other.getByText("凭据无效", { exact: true }).count()) === 0,
      String(otherRows) + " rows"
    );
    check(
      "another account gets the explanation instead",
      (await other.getByText("只有站长（ADMIN_EMAILS）可以查看").count()) === 1,
      "refusal text present"
    );
    await shot(other, "other-security.png");
    await otherContext.close();
  } finally {
    await browser.close();
  }

  await writeFile(
    path.join(here, "verification.json"),
    JSON.stringify(
      { base, checkedAt: new Date().toISOString(), checks, observations, screenshots },
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
