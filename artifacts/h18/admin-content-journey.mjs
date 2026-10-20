// H18 evidence: write micro / project / changelog rows from the admin pages, then read them on the
// public site; upload a cover through the presigned R2 path and check the reader sees that object.
//
// Run from the repo root against a running stack:
//   node artifacts/h18/admin-content-journey.mjs http://localhost:3300
//
// The storage PUT is attempted from the browser first. A bucket whose CORS policy does not list this
// origin refuses the browser's request, so the script falls back to signing and uploading the same
// bytes from the test process (no browser CORS) — the ticket, the object and the render are still the
// real ones, and the run says which path it took.
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Buffer } from "node:buffer";

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
const password = "correct-horse-battery";
const stamp = Date.now();
const email = `owner-${stamp}@example.com`;
const microText = `今天把后台写路径接上了 · ${stamp}`;
const projectTitle = `H18 项目 ${stamp}`;
const changelogVersion = `h18-${stamp}`;

/** A 1×1 PNG: enough to prove the bytes travel through the signed URL into the bucket. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const executablePath = process.env.H18_BROWSER_EXE;
const browser = await chromium.launch(
  executablePath === undefined ? {} : { executablePath }
);
const context = await browser.newContext({
  viewport: { height: 1000, width: 1280 },
});
const page = await context.newPage();
const errors = [];

page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

const rpc = async (path, input) => {
  const response = await context.request.post(`${baseUrl}/rpc/${path}`, {
    data: { json: input },
    headers: { origin: baseUrl },
  });

  if (!response.ok()) {
    throw new Error(`${path} failed with ${response.status()}: ${await response.text()}`);
  }

  const body = await response.json();

  // The RPC transport wraps every result as { json: <output> }.
  return body.json ?? body;
};

/**
 * Fills a field and confirms the value stuck. The admin forms are client components, so a fill that
 * races hydration is silently reset to the empty state and the browser then blocks the submit.
 */
const setField = async (selector, value) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.fill(selector, value);

    if ((await page.inputValue(selector)) === value) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`could not set ${selector}`);
};

/**
 * Waits until React has attached its props to the form. A dev page that has painted but not hydrated
 * answers a submit with a native GET, which reloads the empty form instead of calling the mutation.
 */
const waitForHydration = async (selector = "form") => {
  await page.waitForFunction(
    (target) => {
      const node = document.querySelector(target);

      return (
        node !== null &&
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      );
    },
    selector,
    { timeout: 60_000 }
  );
};

const checks = {};
let coverKey = "";
let uploadPath = "none";
let browserUploadBlocked = false;
const created = { changelog: null, install: null, micro: null, project: null };

try {
  const signUp = await context.request.post(`${baseUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Owner", password },
    headers: { origin: baseUrl },
  });

  if (!signUp.ok()) {
    throw new Error(`sign-up failed with ${signUp.status()}: ${await signUp.text()}`);
  }

  // 1. A micro post, through its admin form.
  await page.goto(`${baseUrl}/settings/admin/micro/new`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration();
  await setField("#micro-content", microText);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/settings\/admin\/micro\/[0-9a-f-]{36}/u, {
    timeout: 30_000,
  });

  created.micro = page.url().split("/").pop() ?? null;

  await page.screenshot({ path: "artifacts/h18/admin-micro-editor.png" });

  await page.goto(`${baseUrl}/settings/admin/micro`, {
    waitUntil: "domcontentloaded",
  });

  const listText = await page.locator('[data-slot="admin-micro-list"]').innerText();

  checks.microInAdminList = listText.includes(microText);

  await page.screenshot({ path: "artifacts/h18/admin-micro-list.png" });

  await page.goto(`${baseUrl}/micro`, { waitUntil: "domcontentloaded" });

  checks.microOnPublicPage = await page
    .getByText(microText, { exact: false })
    .first()
    .isVisible();

  await page.screenshot({ path: "artifacts/h18/public-micro.png" });

  // 2. A project with a cover uploaded through the presigned PUT.
  await page.goto(`${baseUrl}/settings/admin/projects/new`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration();
  await setField("#project-title", projectTitle);

  const ticket = await rpc("media/uploads/presign", {
    contentType: "image/png",
    prefix: "projects",
    scope: "h18",
    size: PNG.byteLength,
  });

  coverKey = ticket.key;

  const keyInput = page.locator('input[aria-label="封面图 key"]');

  await page.setInputFiles('input[type="file"]', {
    buffer: PNG,
    mimeType: "image/png",
    name: "cover.png",
  });

  // The uploader writes the key when the PUT resolves, so poll for it instead of reading once.
  let browserKey = "";
  const startedUpload = Date.now();

  while (browserKey === "" && Date.now() - startedUpload < 30_000) {
    await page.waitForTimeout(500);
    browserKey = await keyInput.inputValue();
  }

  const browserUpload = browserKey !== "";

  if (!browserUpload) {
    // The bucket's CORS policy does not list this origin; sign nothing new, just send the same bytes
    // through the ticket this run already holds.
    const put = await context.request.put(ticket.uploadUrl, {
      data: PNG,
      headers: { "Content-Type": ticket.contentType },
    });

    if (!put.ok()) {
      throw new Error(`direct PUT failed with ${put.status()}: ${await put.text()}`);
    }

    await setField('input[aria-label="封面图 key"]', coverKey);
    browserUploadBlocked = true;
    uploadPath = "server-side (bucket CORS does not list this origin)";
  } else {
    coverKey = await keyInput.inputValue();
    uploadPath = "browser";
  }

  checks.coverKeyStored = coverKey !== "";

  await page.screenshot({ path: "artifacts/h18/admin-project-editor.png" });

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/settings\/admin\/projects\/[0-9a-f-]{36}/u, {
    timeout: 30_000,
  });

  created.project = page.url().split("/").pop() ?? null;

  await page.goto(`${baseUrl}/projects`, { waitUntil: "domcontentloaded" });

  const cover = page.locator(`img[src*="${coverKey}"]`);

  checks.coverOnPublicPage = (await cover.count()) > 0;

  // The loader is asynchronous, so give the image a moment to settle instead of reading it once.
  const loaded = async () =>
    await cover
      .first()
      .evaluate((element) => element.complete && element.naturalWidth > 0)
      .catch(() => false);

  for (let attempt = 0; attempt < 20 && !(await loaded()); attempt += 1) {
    await page.waitForTimeout(500);
  }

  checks.coverLoaded = await loaded();

  await page.screenshot({ path: "artifacts/h18/public-projects.png" });

  // 3. A changelog entry, through its admin form.
  await page.goto(`${baseUrl}/settings/admin/changelog/new`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration();
  await setField("#changelog-version", changelogVersion);
  await setField("#changelog-changes", "新增微言写路径\n新增项目封面直传");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/settings\/admin\/changelog\/[0-9a-f-]{36}/u, {
    timeout: 30_000,
  });

  created.changelog = page.url().split("/").pop() ?? null;
  checks.changelogCreated = created.changelog !== null;

  await page.goto(`${baseUrl}/settings/admin/changelog`, {
    waitUntil: "domcontentloaded",
  });

  const changelogList = await page
    .locator('[data-slot="admin-changelog-list"]')
    .innerText();

  checks.changelogInAdminList = changelogList.includes(changelogVersion);

  // A bucket whose CORS policy does not list this origin refuses the browser's PUT. That refusal is
  // the documented deployment prerequisite, not a defect in the page, so it is reported on its own.
  const storageNoise = errors.filter(
    (message) =>
      message.includes("cloudflarestorage.com") ||
      (browserUploadBlocked && message.includes("net::ERR_FAILED"))
  );

  checks.noConsoleErrors = errors.length === storageNoise.length;
  // The bucket's CORS policy lists the site origin, so the browser path is the expected one; a
  // refusal here means the deployment prerequisite regressed.
  checks.coverUploadedFromBrowser = !browserUploadBlocked;
} finally {
  // The run reads the development database, so every row it created is removed again.
  const ROUTES = { changelog: "changelog", micro: "micro", project: "projects" };

  for (const [kind, id] of Object.entries(created)) {
    if (kind === "install" || id === null) {
      continue;
    }

    const removed = await context.request
      .post(`${baseUrl}/rpc/content/${ROUTES[kind] ?? kind}/remove`, {
        data: { json: { id } },
        headers: { origin: baseUrl },
      })
      .catch(() => null);

    if (removed === null || !removed.ok()) {
      console.error(
        `cleanup: could not remove the ${kind} row ${id}: ${removed?.status() ?? "request failed"}`,
        removed === null ? "" : await removed.text()
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        browserUploadBlocked,
        checks,
        coverKey,
        created,
        errors,
        microText,
        projectTitle,
        uploadPath,
      },
      null,
      2
    )
  );

  await browser.close();

  if (Object.values(checks).some((value) => value !== true)) {
    process.exitCode = 1;
  }
}
