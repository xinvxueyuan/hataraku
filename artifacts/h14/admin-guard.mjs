// H14 evidence: the admin area is closed to visitors who are not signed in.
//
// Run against a running stack:
//   node artifacts/h14/admin-guard.mjs http://localhost:3300
//
// The other half of the gate — a signed-in account outside ADMIN_EMAILS — cannot be produced by a
// fresh sign-up on a deployment that sets the allowlist, because the same allowlist also refuses
// account creation. It is covered by the API integration test (FORBIDDEN) and rendered by the 403
// block; see artifacts/h14/README.md.
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const store = "node_modules/.pnpm";
const packageDir = readdirSync(store).find((entry) =>
  entry.startsWith("playwright-core@")
);

if (packageDir === undefined) {
  throw new Error("playwright-core is not installed in this workspace");
}

const { chromium } = require(
  join(process.cwd(), store, packageDir, "node_modules", "playwright-core")
);

const baseUrl = process.argv[2] ?? "http://localhost:3300";

const executablePath = process.env.H11_BROWSER_EXE;
const browser = await chromium.launch(
  executablePath === undefined ? {} : { executablePath }
);

try {
  // A fresh context has no session cookie: this is a visitor who never signed in.
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/settings/admin/posts`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(/\/login\?redirect=/u, { timeout: 30_000 });

  const redirectedTo = page.url();
  const hasEditor = await page.locator("#post-title").count();

  await page.screenshot({ path: "artifacts/h14/anonymous-redirect.png" });

  const checks = {
    editorAbsent: hasEditor === 0,
    redirectedToLogin: redirectedTo.startsWith(`${baseUrl}/login`),
    redirectKeepsTarget: decodeURIComponent(redirectedTo).includes(
      "/settings/admin/posts"
    ),
  };

  console.log(JSON.stringify({ checks, redirectedTo }, null, 2));

  if (Object.values(checks).some((passed) => !passed)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
