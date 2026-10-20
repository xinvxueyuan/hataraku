// Drives a real Chromium through /settings/security and the v2 article URLs.
//
// The scratch database holds two accounts (owner@h20.test on ADMIN_EMAILS, other@h20.test off it),
// two posts (one published, one draft) and two sign-in attempts; the session cookies were captured
// before the web app started with the allowlist. Run against the web app on PROBE_BASE.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3360";
const cookieFile = process.env.H20_COOKIE_FILE;
const shotsDir = path.join(here, "screenshots");

const { chromium } = createRequire(
  path.join(repo, "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js")
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

const sessionCookie = (cookies, email) => {
  const entry = cookies[email];

  if (entry === undefined) {
    throw new Error("no stored cookie for " + email);
  }

  return { domain: "localhost", name: entry.name, path: "/", value: entry.value };
};

const redirect = async (request, route) => {
  const response = await request.get(base + route, { maxRedirects: 0 });
  const location = response.headers()["location"] ?? "";

  return {
    location: location.replace(/^https?:\/\/[^/]+/u, ""),
    status: response.status(),
  };
};

const main = async () => {
  await mkdir(shotsDir, { recursive: true });

  if (cookieFile === undefined || cookieFile === "") {
    throw new Error("H20_COOKIE_FILE is not set");
  }

  const cookies = JSON.parse(await readFile(cookieFile, "utf8"));
  const browser = await chromium.launch();

  try {
    // Anonymous visitors never reach the page, and the login form knows where to come back to.
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(base + "/settings/security", {
      waitUntil: "networkidle",
    });
    check(
      "the page is protected and remembers its address",
      decodeURIComponent(anonymousPage.url()).endsWith(
        "/login?redirect=/settings/security"
      ),
      anonymousPage.url()
    );
    await shot(anonymousPage, "anonymous-login.png");
    await anonymous.close();

    // The owner: own sessions, own 2FA state, and the deployment's attempts.
    const ownerContext = await browser.newContext();
    await ownerContext.addCookies([sessionCookie(cookies, "owner@h20.test")]);
    const owner = await ownerContext.newPage();
    await owner.goto(base + "/settings/security", { waitUntil: "networkidle" });
    check(
      "the owner sees the security overview",
      (await owner.getByRole("heading", { name: "安全概览" }).count()) === 1,
      owner.url()
    );
    check(
      "the overview names the signed-in account",
      (await owner.getByText("owner@h20.test").count()) >= 1,
      "owner address shown"
    );
    check(
      "the owner's own session is listed and marked current",
      (await owner.getByText("共 1 个未过期的会话").count()) === 1 &&
        (await owner.getByText("当前", { exact: true }).count()) >= 1,
      "one active session, current badge"
    );
    const digests = await owner.getByText("IP 摘要 0123456789ab").count();
    check(
      "the attempts table renders the stored rows",
      (await owner.getByText("密码错误", { exact: true }).count()) === 1 &&
        (await owner.getByText("已发送", { exact: true }).count()) === 1 &&
        // Both seeded rows were recorded from the same address, so the digest appears twice.
        digests === 2,
      "password_fail + sent, digest rows: " + digests
    );
    check(
      "the sent attempt keeps its duration",
      (await owner.getByText("123 ms").count()) === 1,
      "123 ms"
    );
    check(
      "the two-factor state is shown with a link to its page",
      (await owner.getByText("未开启", { exact: true }).count()) === 1 &&
        (await owner.getByRole("link", { name: "现在绑定验证器" }).getAttribute("href")) ===
          "/settings/two-factor",
      "未开启 + /settings/two-factor"
    );
    check(
      "the owner never sees the admin-only explanation",
      (await owner.getByText("只有站长（ADMIN_EMAILS）可以查看").count()) === 0,
      "no refusal text"
    );
    await shot(owner, "owner-security.png");
    await ownerContext.close();

    // Another account: its own sessions only, and no attempt data at all.
    const otherContext = await browser.newContext();
    await otherContext.addCookies([sessionCookie(cookies, "other@h20.test")]);
    const other = await otherContext.newPage();
    await other.goto(base + "/settings/security", { waitUntil: "networkidle" });
    check(
      "another account reaches its own overview",
      (await other.getByText("other@h20.test").count()) >= 1,
      other.url()
    );
    check(
      "another account sees exactly its own session",
      (await other.getByText("共 1 个未过期的会话").count()) === 1,
      "one active session"
    );
    check(
      "another account sees no attempt rows",
      (await other.getByText("密码错误", { exact: true }).count()) === 0 &&
        (await other.getByText("已发送", { exact: true }).count()) === 0 &&
        (await other.getByText("IP 摘要 0123456789ab").count()) === 0,
      "no attempt data"
    );
    check(
      "another account is told why, and is not shown the owner's address",
      (await other.getByText("只有站长（ADMIN_EMAILS）可以查看").count()) === 1 &&
        (await other.getByText("owner@h20.test").count()) === 0,
      "refusal text present, owner address absent"
    );
    await shot(other, "other-security.png");
    await otherContext.close();

    // v2 article URLs: a published post is a permanent forward, everything else lands on the list.
    const apiContext = await browser.newContext();
    const request = apiContext.request;
    const published = await redirect(request, "/article/legacy-article");
    check(
      "a published old article URL answers 308 to the new one",
      published.status === 308 && published.location === "/posts/legacy-article",
      published.status + " -> " + published.location
    );
    const draft = await redirect(request, "/article/legacy-draft");
    check(
      "an unpublished slug answers 307 to the list",
      draft.status === 307 && draft.location === "/article",
      draft.status + " -> " + draft.location
    );
    const missing = await redirect(request, "/article/no-such-post");
    check(
      "an unknown slug answers 307 to the list",
      missing.status === 307 && missing.location === "/article",
      missing.status + " -> " + missing.location
    );
    const list = await request.get(base + "/article", { maxRedirects: 0 });
    check(
      "the list page still answers 200 and is not swallowed by the redirect",
      list.status() === 200 && (await list.text()).includes("文章"),
      "status " + String(list.status())
    );
    const target = await request.get(base + "/posts/legacy-article", {
      maxRedirects: 0,
    });
    check(
      "the new URL serves the article",
      target.status() === 200 && (await target.text()).includes("旧地址文章"),
      "status " + String(target.status())
    );
    await apiContext.close();
  } finally {
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
