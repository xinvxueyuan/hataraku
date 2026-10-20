// Proves the web deployment serves its pages, auth and procedures without an API server:
// phase "before" runs against the full two-process stack, phase "after" runs with the API
// process stopped, so a page that still renders data can only have read it in process.
//
//   PROBE_PHASE=before node artifacts/h16/verify-single-deployment.mjs
//   PROBE_PHASE=after  node artifacts/h16/verify-single-deployment.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE ?? "http://localhost:3400";
const apiBase = process.env.PROBE_API_BASE ?? "http://localhost:3401";
const phase = process.env.PROBE_PHASE ?? "before";
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

const status = async (url) => {
  try {
    const response = await fetch(url);
    await response.arrayBuffer();
    return response.status;
  } catch {
    return "unreachable";
  }
};

const email = "probe-" + phase + "-" + Date.now() + "@example.com";
const password = "correct-horse-battery";

const main = async () => {
  await mkdir(shotsDir, { recursive: true });

  // The API process is the control for this experiment.
  const apiStatus = await status(apiBase + "/api/health");
  check(
    phase === "before"
      ? "the standalone API process is up before the experiment"
      : "the standalone API process is stopped",
    phase === "before" ? apiStatus === 200 : apiStatus !== 200,
    apiBase + " -> " + String(apiStatus)
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 1500 } });
  const page = await context.newPage();

  try {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    const heading = (await page.locator("h1").first().textContent()) ?? "";
    check(
      "the home page renders server-read content",
      heading.trim().length > 0 && (await page.getByText("最新文章").count()) === 1,
      "h1: " + heading.trim() + "; 最新文章 present"
    );
    check(
      "the home page reports the API as connected",
      (await page.getByText("Connected").count()) >= 1,
      "api status pill present"
    );
    await shot(page, phase + "-01-home.png");

    await page.goto(base + "/article", { waitUntil: "networkidle" });
    check(
      "the article index renders through the in-process router",
      (await page.locator("h1").first().textContent())?.trim().length > 0,
      page.url()
    );
    await shot(page, phase + "-02-article.png");

    // Auth runs in the web process: a new account and a session it can read back.
    const signUp = await page.evaluate(
      async (credentials) => {
        const response = await fetch("/api/auth/sign-up/email", {
          body: JSON.stringify({ ...credentials, name: "Probe" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        return { body: await response.text(), status: response.status };
      },
      { email, password }
    );
    check(
      "sign-up is served in process",
      signUp.status === 200,
      "status " + String(signUp.status)
    );

    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");

      return await response.json();
    });
    check(
      "the session endpoint reads the cookie in process",
      session?.user?.email === email,
      "get-session user: " + String(session?.user?.email)
    );

    // A protected procedure through the RPC transport that used to be proxied.
    const created = await page.evaluate(async () => {
      const response = await fetch("/rpc/todos/create", {
        body: JSON.stringify({ json: { title: "H16 probe todo" } }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return { body: await response.text(), status: response.status };
    });
    let createdBody = null;
    try {
      createdBody = JSON.parse(created.body);
    } catch {
      createdBody = null;
    }
    check(
      "a protected procedure writes over /rpc in process",
      created.status === 200 &&
        createdBody?.json?.title === "H16 probe todo" &&
        typeof createdBody?.json?.id === "number",
      "status " + String(created.status) + ", id " + String(createdBody?.json?.id)
    );

    const listed = await page.evaluate(async () => {
      const response = await fetch("/rpc/todos/list", {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return { body: await response.text(), status: response.status };
    });
    check(
      "the same procedure reads it back",
      listed.status === 200 && listed.body.includes("H16 probe todo"),
      "status " + String(listed.status)
    );

    // The OpenAPI transport keeps the document and the reference UI the proxy used to forward.
    const openApi = await page.evaluate(async () => {
      const response = await fetch("/api");

      return {
        contentType: response.headers.get("content-type") ?? "",
        status: response.status,
      };
    });
    check(
      "the OpenAPI transport answers at /api",
      openApi.status === 200,
      "status " + String(openApi.status) + ", " + openApi.contentType
    );

    // Pages behind the session prove getSession no longer asks an API over HTTP.
    await page.goto(base + "/todos", { waitUntil: "networkidle" });
    check(
      "a protected page renders its data",
      (await page.getByText("H16 probe todo").count()) >= 1,
      page.url()
    );
    await shot(page, phase + "-03-todos.png");

    await page.goto(base + "/settings/two-factor", { waitUntil: "networkidle" });
    check(
      "the two-factor page reads the session in process",
      (await page.getByRole("button", { name: "Set up an authenticator app" }).count()) === 1,
      page.url()
    );
    await shot(page, phase + "-04-two-factor.png");
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(here, "verification-" + phase + ".json"),
    JSON.stringify(
      {
        base,
        apiBase,
        checkedAt: new Date().toISOString(),
        checks,
        phase,
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
