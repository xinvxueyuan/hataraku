// H14 evidence: write a post through the admin editor, publish it, and read the public page.
//
// Run from the repo root against a running stack:
//   node artifacts/h14/admin-journey.mjs http://localhost:3300
//
// The browser context signs up first, so the admin pages see a real session. Typing goes through the
// real editor (markdown shortcuts for the heading and the list, the toolbar for the code block), and
// the last step reads the published article the reader would see.
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
const password = "correct-horse-battery";
const stamp = Date.now();
const email = `owner-${stamp}@example.com`;
const slug = `h14-journey-${stamp}`;
const title = "H14 端到端示例";
const paragraph = "这是由后台编辑器写入的一段正文。";
const heading = "小标题";
const itemTwo = "第二项";
const code = 'console.log("written in the editor");';

const executablePath = process.env.H11_BROWSER_EXE;
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

try {
  const signUp = await context.request.post(`${baseUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Owner", password },
    headers: { origin: baseUrl },
  });

  if (!signUp.ok()) {
    throw new Error(`sign-up failed with ${signUp.status()}`);
  }

  await page.goto(`${baseUrl}/settings/admin/posts/new`, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("#post-title", { timeout: 60_000 });
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("Slug").fill(slug);

  // The editor mounts on the client, so wait for its editable surface before typing. "## " and "- "
  // are markdown shortcuts the editor turns into a heading and a list as they are typed.
  const editable = page.locator('[contenteditable="true"]').first();

  await editable.waitFor({ state: "visible", timeout: 60_000 });
  await editable.click();

  await page.keyboard.type(paragraph);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("## ");
  await page.keyboard.type(heading);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- ");
  await page.keyboard.type("第一项");
  await page.keyboard.press("Enter");
  await page.keyboard.type(itemTwo);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");

  // The code block goes in through the toolbar: its fence has to be a real node, not typed
  // characters, or the stored markdown would carry escaped backticks.
  const toolbarLabels = await page
    .locator(".mdxeditor-toolbar button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? "")
    );

  await page.locator('button[aria-label*="code block" i]').first().click();

  const codeMirror = page.locator(".cm-content").first();

  await codeMirror.waitFor({ state: "visible", timeout: 15_000 });
  await codeMirror.click();
  await page.keyboard.type(code);

  await page.screenshot({ path: "artifacts/h14/editor.png" });

  await page.getByRole("button", { name: "创建草稿" }).click();
  await page.waitForURL(/\/settings\/admin\/posts\/[0-9a-f-]{36}$/u, {
    timeout: 30_000,
  });

  const postId = page.url().split("/").pop();
  const stored = await context.request.post(`${baseUrl}/rpc/posts/byId`, {
    data: { json: { id: postId } },
  });

  // The RPC transport wraps the output in `{ json: ... }`; the body is what the editor saved.
  const storedBody = stored.ok() ? JSON.parse(await stored.text()).json : null;
  const bodyMd = storedBody === null ? "" : String(storedBody.bodyMd ?? "");

  await page.getByRole("button", { name: "发布" }).click();
  await page.getByText("当前状态：已发布").waitFor({ timeout: 30_000 });

  await page.goto(`${baseUrl}/posts/${slug}`, { waitUntil: "domcontentloaded" });

  const article = {
    code: await page.locator("pre code").first().innerText().catch(() => ""),
    headingTwo: await page
      .locator("article h2")
      .first()
      .innerText()
      .catch(() => ""),
    listItems: await page.locator("article ul li").count(),
    text: (await page.locator("article").innerText()).slice(0, 400),
  };

  await page.screenshot({ path: "artifacts/h14/published.png" });

  const checks = {
    articleHasHeading: article.headingTwo === heading,
    articleHasList: article.listItems >= 2,
    articleHasParagraph: article.text.includes(paragraph),
    articleRenderedCode: article.code.includes("console.log"),
    bodyHasCodeFence: bodyMd.includes("```"),
    bodyHasHeading: bodyMd.includes("## "),
    bodyHasList: bodyMd.includes("- ") || bodyMd.includes("* "),
    noConsoleErrors: errors.length === 0,
  };

  console.log(
    JSON.stringify(
      { article, bodyMd, checks, errors, postId, slug, toolbarLabels },
      null,
      2
    )
  );

  if (Object.values(checks).some((passed) => !passed)) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
