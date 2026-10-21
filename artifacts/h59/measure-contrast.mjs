// Measures contrast from computed colours (the value WCAG evaluates), in both themes. CSS colours are
// resolved to sRGB through a canvas, which understands lab()/oklab()/oklch() serialisations.
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const here = import.meta.dirname;
const repo = path.resolve(here, "..", "..");
const base = process.env.PROBE_BASE;
const label = process.env.PROBE_LABEL ?? "run";

const { chromium } = createRequire(
  path.join(
    repo,
    "node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js"
  )
)("./index.js");

const probeScript = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const toRgb = (cssColor) => {
    if (context === null) return null;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = cssColor;
    if (context.fillStyle === "#000" && cssColor.trim() !== "#000" && cssColor.trim() !== "black") {
      return null;
    }
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return { alpha: data[3] / 255, rgb: [data[0] / 255, data[1] / 255, data[2] / 255] };
  };
  const luminance = (rgb) => {
    const linear = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (first, second) => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const solidBackground = (element) => {
    let node = element;
    while (node !== null) {
      const resolved = toRgb(getComputedStyle(node).backgroundColor);
      if (resolved !== null && resolved.alpha >= 0.999) return resolved.rgb;
      node = node.parentElement;
    }
    return [1, 1, 1];
  };
  const describe = (element) => {
    const style = getComputedStyle(element);
    const color = toRgb(style.color);
    if (color === null) return { error: "unresolved", raw: style.color };
    const background = solidBackground(element);
    return {
      contrast: Number(contrast(color.rgb, background).toFixed(2)),
      cssBackground: background.map((c) => Math.round(c * 255)).join(","),
      cssColor: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      text: (element.textContent ?? "").trim().slice(0, 28),
    };
  };

  const results = {
    docClass: document.documentElement.className,
    theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
    tokenMuted: getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim(),
  };

  const summary = [...document.querySelectorAll("summary")].find((node) =>
    node.textContent?.includes("更多")
  );
  if (summary !== undefined) {
    if (!summary.parentElement.open) summary.click();
    results.more = [...summary.parentElement.querySelectorAll("ul a")].map(describe);
  }

  results.description = [...document.querySelectorAll("main p.text-muted-foreground")]
    .slice(0, 3)
    .map(describe);
  results.dates = [...document.querySelectorAll("time")].slice(0, 2).map(describe);
  results.badges = [...document.querySelectorAll('[data-slot="badge"]')].slice(0, 3).map(describe);
  results.footer = [...document.querySelectorAll("footer a, footer p")].slice(0, 3).map(describe);
  results.body = [...document.querySelectorAll("main p")]
    .filter((node) => !node.className.includes("muted"))
    .slice(0, 2)
    .map(describe);
  results.heading = [...document.querySelectorAll("main h1")].slice(0, 1).map(describe);
  results.disabledButtons = [...document.querySelectorAll("button[disabled]")].slice(0, 2).map(describe);

  const input = document.querySelector('input[type="email"]');
  if (input !== null) {
    const placeholder = toRgb(getComputedStyle(input, "::placeholder").color);
    const background = solidBackground(input);
    results.placeholder = {
      contrast: placeholder === null ? null : Number(contrast(placeholder.rgb, background).toFixed(2)),
      cssColor: getComputedStyle(input, "::placeholder").color,
    };
  }

  return results;
};

const measureTheme = async (page, theme) => {
  if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForTimeout(250);
  }
  const result = await page.evaluate(probeScript);
  if (theme === "dark") {
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.waitForTimeout(250);
  }
  return result;
};

const measureBoth = async (page) => {
  const light = await measureTheme(page, "light");
  const dark = await measureTheme(page, "dark");
  return { dark, light };
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(base + "/", { waitUntil: "networkidle" });
const home = await measureBoth(page);

await page.goto(base + "/article", { waitUntil: "networkidle" });
const article = await measureBoth(page);

await page.goto(base + "/taxonomy", { waitUntil: "networkidle" });
const taxonomy = await measureBoth(page);

await page.goto(base + "/archive", { waitUntil: "networkidle" });
const archive = await measureBoth(page);

await page.goto(base + "/login", { waitUntil: "networkidle" });
const login = await measureBoth(page);

// A disabled control for the exemption note.
await page.goto(base + "/todos", { waitUntil: "networkidle" });
const todos = await measureBoth(page);

const report = { archive, article, home, label, login, taxonomy, todos };
await writeFile(path.join(here, `contrast-${label}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

await context.close();
await browser.close();