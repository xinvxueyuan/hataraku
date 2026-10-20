// H32 evidence: the admin lists are operable — server-side search, filters, paging, and a URL that
// reproduces the whole view; plus the /settings/admin index that lists every entry point.
//
// Run from the repo root against a running stack:
//   node artifacts/h32/admin-lists-journey.mjs http://localhost:3302
//
// Rows are created through the RPC API (not by filling forms — the forms are covered by the H18/H24
// journeys) and deleted again in the finally block, so the development database is left as it was.
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

const baseUrl = process.argv[2] ?? "http://localhost:3302";
const stamp = Date.now();
const password = "correct-horse-battery";
const email = `owner-${stamp}@example.com`;
const mark = `h32-${stamp}`;
const PAGES = { pageSize: 10 };

const executablePath = process.env.H32_BROWSER_EXE;
const browser = await chromium.launch(
  executablePath === undefined ? {} : { executablePath }
);
const context = await browser.newContext({
  viewport: { height: 1100, width: 1280 },
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

  return body.json ?? body;
};

const created = { changelog: [], micro: [], posts: [], projects: [] };

const rowCount = async (slot) =>
  await page.locator(`[data-slot="${slot}"] li`).count();

const checks = {};

try {
  const signUp = await context.request.post(`${baseUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Owner", password },
    headers: { origin: baseUrl },
  });

  if (!signUp.ok()) {
    throw new Error(`sign-up failed with ${signUp.status()}: ${await signUp.text()}`);
  }

  // Twelve posts with one shared token: ten on the first page, two on the second, which is what
  // makes "paging keeps the filter" observable.
  for (let index = 1; index <= 12; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const published = index > 8;

    const post = await rpc("posts/create", {
      bodyMd: `正文 ${suffix}：${mark}`,
      publishedAt: published ? `2026-01-${suffix}` : null,
      slug: `${mark}-post-${suffix}`,
      status: published ? "published" : "draft",
      title: `${mark} 文章 ${suffix}`,
    });

    created.posts.push(post.id);
  }

  // The slug is derived from the ASCII part of the content, so the two notes need distinct ones.
  const microText = await rpc("content/micro/create", {
    content: `${mark}-text 纯文字`,
    published: true,
    type: "text",
  });
  const microCode = await rpc("content/micro/create", {
    content: `${mark}-code 代码片段`,
    published: false,
    type: "code",
  });

  created.micro.push(microText.id, microCode.id);

  const projectActive = await rpc("content/projects/create", {
    published: true,
    slug: `${mark}-active`,
    status: "active",
    title: `${mark} 进行中`,
  });
  const projectArchived = await rpc("content/projects/create", {
    published: false,
    slug: `${mark}-archived`,
    status: "archived",
    title: `${mark} 已归档`,
  });

  created.projects.push(projectActive.id, projectArchived.id);

  const plainEntry = await rpc("content/changelog/create", {
    releasedAt: "2026-02-01",
    title: `${mark} 普通`,
    version: `${mark}-1.0.0`,
  });
  const highlightedEntry = await rpc("content/changelog/create", {
    highlight: true,
    releasedAt: "2026-02-02",
    title: `${mark} 重点`,
    version: `${mark}-2.0.0`,
  });

  created.changelog.push(plainEntry.id, highlightedEntry.id);

  // 1. The index lists every surface with its live count.
  await page.goto(`${baseUrl}/settings/admin`, { waitUntil: "domcontentloaded" });

  const indexText = await page.locator('[data-slot="admin-index"]').innerText();

  checks.indexListsEverySurface = [
    "文章",
    "微言",
    "项目",
    "更新日志",
    "站点",
    "安全",
    "密码",
    "两步验证",
  ].every((label) => indexText.includes(label));
  checks.indexShowsLiveCount = /\d+ 篇 · 草稿 \d+/.test(indexText);
  await page.screenshot({ path: "artifacts/h32/index.png" });

  // 2. The posts list shows one page of ten.
  await page.goto(`${baseUrl}/settings/admin/posts`, {
    waitUntil: "domcontentloaded",
  });

  checks.firstPageHasTenRows = (await rowCount("admin-post-list")) === 10;
  checks.unfilteredTotalIsShown = (
    await page.locator('[data-slot="admin-list-toolbar"]').innerText()
  ).includes("共 ");

  // 3. Search narrows to the rows the token names, then to one row.
  await page.goto(`${baseUrl}/settings/admin/posts?q=${mark}`, {
    waitUntil: "domcontentloaded",
  });

  const searchedTotal = await page
    .locator('[data-slot="admin-list-toolbar"]')
    .innerText();

  checks.searchNarrowsToTwelve = searchedTotal.includes("共 12 条");

  await page.goto(`${baseUrl}/settings/admin/posts?q=${mark}-post-03`, {
    waitUntil: "domcontentloaded",
  });

  checks.searchNarrowsToOne = (await rowCount("admin-post-list")) === 1;
  await page.screenshot({ path: "artifacts/h32/posts-search.png" });

  // 4. The status filter keeps only the published half, and the search still applies.
  await page.goto(`${baseUrl}/settings/admin/posts?q=${mark}&status=published`, {
    waitUntil: "domcontentloaded",
  });

  checks.filterKeepsOnlyPublished =
    (await rowCount("admin-post-list")) === 4;
  checks.filterSelectionIsRendered =
    (await page.locator("#admin-status").inputValue()) === "published";

  // 5. The second page keeps the filter in its URL.
  await page.goto(`${baseUrl}/settings/admin/posts?q=${mark}`, {
    waitUntil: "domcontentloaded",
  });

  const nextHref = await page
    .locator('nav[aria-label="文章分页"] a[href*="page=2"]')
    .getAttribute("href");

  checks.pagerKeepsFilter =
    nextHref !== null && nextHref.includes(`q=${mark}`);

  await page.goto(`${baseUrl}${nextHref}`, { waitUntil: "domcontentloaded" });

  checks.secondPageHasRest = (await rowCount("admin-post-list")) === 2;
  checks.secondPageKeepsFilterInput =
    (await page.locator("#admin-search").inputValue()) === mark;
  await page.screenshot({ path: "artifacts/h32/posts-page-2.png" });

  // 6. Pasting the URL into a fresh tab reproduces the same view.
  const freshPage = await context.newPage();
  const pastedUrl = `${baseUrl}/settings/admin/posts?q=${mark}&page=2`;

  await freshPage.goto(pastedUrl, { waitUntil: "domcontentloaded" });

  checks.pastedUrlReproducesView =
    (await freshPage.locator('[data-slot="admin-post-list"] li').count()) === 2 &&
    (await freshPage.locator("#admin-search").inputValue()) === mark;

  await freshPage.close();

  // 7. Each content list combines its own filter with the shared search.
  await page.goto(`${baseUrl}/settings/admin/micro?q=${mark}&type=code`, {
    waitUntil: "domcontentloaded",
  });

  checks.microFiltersByType = (await rowCount("admin-micro-list")) === 1;
  await page.screenshot({ path: "artifacts/h32/micro-filtered.png" });

  await page.goto(`${baseUrl}/settings/admin/projects?q=${mark}&status=archived`, {
    waitUntil: "domcontentloaded",
  });

  checks.projectsFilterByStatus = (await rowCount("admin-project-list")) === 1;

  await page.goto(
    `${baseUrl}/settings/admin/changelog?highlight=true&q=${mark}`,
    { waitUntil: "domcontentloaded" }
  );

  checks.changelogFiltersToHighlights =
    (await rowCount("admin-changelog-list")) === 1;

  checks.noConsoleErrors = errors.length === 0;
} finally {
  const ROUTES = {
    changelog: "content/changelog",
    micro: "content/micro",
    posts: "posts",
    projects: "content/projects",
  };

  for (const [kind, ids] of Object.entries(created)) {
    for (const id of ids) {
      await context.request
        .post(`${baseUrl}/rpc/${ROUTES[kind]}/remove`, {
          data: { json: { id } },
          headers: { origin: baseUrl },
        })
        .catch(() => null);
    }
  }

  console.log(JSON.stringify({ checks, errors, mark, removed: created }, null, 2));

  await browser.close();

  if (Object.values(checks).some((value) => value !== true)) {
    process.exitCode = 1;
  }
}
