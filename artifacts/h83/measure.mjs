import playwrightCore from "../../node_modules/.pnpm/playwright-core@1.64.0/node_modules/playwright-core/index.js";

const { chromium } = playwrightCore;

const base = "http://127.0.0.1:3000";
const targets = [
  ["hub", "/toolbox"],
  ["tools", "/toolbox/tools"],
  ["devices", "/toolbox/devices"],
  ["skills", "/toolbox/skills"],
  ["friends", "/toolbox/friends"],
  ["about", "/about"],
];

const browser = await chromium.launch({
  executablePath: process.env.H83_CHROME,
  args: ["--no-sandbox"],
});

const rows = [];

for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 } });
  const page = await context.newPage();
  for (const [name, path] of targets) {
    const response = await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 });
    const metrics = await page.evaluate(() => {
      const el = document.documentElement;
      const overflows = [...document.querySelectorAll("body *")]
        .filter((node) => node.getBoundingClientRect().right > el.clientWidth + 1)
        .slice(0, 5)
        .map((node) => node.tagName + ":" + node.className.toString().slice(0, 80));
      return {
        clientWidth: el.clientWidth,
        overflow: overflows,
        scrollWidth: el.scrollWidth,
        title: document.title,
      };
    });
    const visible = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        firstScreenEnd: window.innerHeight,
        hasBackLink: text.includes("← 工具箱"),
        hasEmptyHub: text.includes("还没有内容"),
        hasTimelineHeading: text.includes("时间线"),
      };
    });
    rows.push({
      name,
      status: response?.status() ?? null,
      viewport: width,
      ...metrics,
      ...visible,
      equal: metrics.scrollWidth === metrics.clientWidth,
    });
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify(rows, null, 2));
