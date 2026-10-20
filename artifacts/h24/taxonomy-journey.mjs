// H24 evidence: file one article under a category and two tags, publish it, and read it back from
// the public taxonomy pages; the cover is uploaded through the presigned R2 path.
//
// Run from the repo root against a running stack:
//   node artifacts/h24/taxonomy-journey.mjs http://localhost:3300
//
// The run reuses the taxonomy the site already has (a category and two tags with published posts) so
// the development database is left as it was; the article it creates is deleted in the finally block.
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
const stamp = Date.now();
const password = "correct-horse-battery";
const email = `owner-${stamp}@example.com`;
const slug = `h24-filed-${stamp}`;
const title = `H24 归档示例 ${stamp}`;
const body = "## 归档小标题\n\n这一段来自后台写作表单。\n";
const cover = "cover.png";

/** A 1×1 PNG: enough to prove the bytes travel through the signed URL into the bucket. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const executablePath = process.env.H24_BROWSER_EXE;
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

/** Fills a field and confirms the value stuck: a fill that races hydration is silently reset. */
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

const waitForHydration = async () => {
  await page.waitForFunction(
    () => {
      const node = document.querySelector("form");

      return (
        node !== null &&
        Object.keys(node).some((key) => key.startsWith("__reactProps$"))
      );
    },
    undefined,
    { timeout: 60_000 }
  );
};

const checks = {};
let postId = null;
let categorySlug = "";
let tagSlug = "";
let secondTagSlug = "";

try {
  const signUp = await context.request.post(`${baseUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Owner", password },
    headers: { origin: baseUrl },
  });

  if (!signUp.ok()) {
    throw new Error(`sign-up failed with ${signUp.status()}: ${await signUp.text()}`);
  }

  // Prefer a category and a tag the site already has, so the run leaves no new taxonomy behind. A
  // database with none at all (the local development one) gets an `h24-` pair, which the cleanup
  // step at the end of the run removes again.
  const overview = await rpc("taxonomy/overview", undefined);
  const reusableCategory = overview.categories.at(0);
  const reusableTags = overview.tags.slice(0, 2);

  categorySlug = reusableCategory?.slug ?? `h24-cat-${stamp}`;
  tagSlug = reusableTags.at(0)?.slug ?? `h24-tag-a-${stamp}`;
  secondTagSlug = reusableTags.at(1)?.slug ?? `h24-tag-b-${stamp}`;
  checks.taxonomyReused = reusableCategory !== undefined && reusableTags.length === 2;

  await page.goto(`${baseUrl}/settings/admin/posts/new`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration();

  await setField("#post-title", title);
  await setField("#post-slug", slug);
  await setField("#post-category", categorySlug);
  await setField("#post-tags", `${tagSlug}, ${secondTagSlug}`);
  await setField("#post-description", "H24 的归档示例。");

  // The body editor mounts on the client; "## " is a markdown shortcut it turns into a heading.
  const editable = page.locator('[contenteditable="true"]').first();

  await editable.waitFor({ state: "visible", timeout: 60_000 });
  await editable.click();
  await page.keyboard.type(body.split("\n")[2] ?? "");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("## ");
  await page.keyboard.type("归档小标题");

  await page.setInputFiles('input[type="file"]', {
    buffer: PNG,
    mimeType: "image/png",
    name: cover,
  });

  const coverInput = page.locator('input[aria-label="封面图 key"]');
  let coverKey = "";
  const startedUpload = Date.now();

  while (coverKey === "" && Date.now() - startedUpload < 30_000) {
    await page.waitForTimeout(500);
    coverKey = await coverInput.inputValue();
  }

  checks.coverUploadedFromBrowser = coverKey !== "";

  await page.screenshot({ path: "artifacts/h24/post-editor.png" });

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/settings\/admin\/posts\/[0-9a-f-]{36}/u, {
    timeout: 30_000,
  });

  postId = page.url().split("/").pop() ?? null;

  // Publish from the form's own action, then read the public surfaces.
  await page.getByRole("button", { exact: true, name: "发布" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("取消发布"),
    undefined,
    { timeout: 30_000 }
  );

  await page.goto(`${baseUrl}/taxonomy/category/${encodeURIComponent(categorySlug)}`, {
    waitUntil: "domcontentloaded",
  });

  checks.categoryPageListsPost = (await page.locator(`a[href="/posts/${slug}"]`).count()) > 0;
  await page.screenshot({ path: "artifacts/h24/taxonomy-category.png" });

  await page.goto(`${baseUrl}/taxonomy/tag/${encodeURIComponent(tagSlug)}`, {
    waitUntil: "domcontentloaded",
  });

  checks.tagPageListsPost = (await page.locator(`a[href="/posts/${slug}"]`).count()) > 0;
  await page.screenshot({ path: "artifacts/h24/taxonomy-tag.png" });

  await page.goto(`${baseUrl}/posts/${slug}`, { waitUntil: "domcontentloaded" });

  checks.articleShowsHeading = (await page.getByRole("heading", { name: "归档小标题" }).count()) > 0;

  await page.screenshot({ path: "artifacts/h24/article.png" });

  // What the form sent is what the row holds: the cover key, the category and both tags.
  const stored = await rpc("posts/byId", { id: postId });

  checks.coverKeyStored = stored.coverKey === coverKey;
  checks.categoryStored = stored.categorySlug === categorySlug;
  checks.bothTagsStored =
    stored.tagSlugs.includes(tagSlug) &&
    stored.tagSlugs.includes(secondTagSlug);
  checks.noConsoleErrors = errors.length === 0;
} finally {
  if (postId !== null) {
    await context.request
      .post(`${baseUrl}/rpc/posts/remove`, {
        data: { json: { id: postId } },
        headers: { origin: baseUrl },
      })
      .catch(() => null);
  }

  console.log(
    JSON.stringify(
      {
        categorySlug,
        checks,
        cover,
        secondTagSlug,
        errors,
        postId,
        removed: postId !== null,
        slug,
        tagSlug,
        title,
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
