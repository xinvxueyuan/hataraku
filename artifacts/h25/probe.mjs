#!/usr/bin/env node
/**
 * H25 probe: the machine-readable surface must describe the four content pages and their kinds.
 *
 *   node artifacts/h25/probe.mjs http://localhost:3302 38 38 7 97 1 --marker "archives/127348.html"
 *   node artifacts/h25/probe.mjs http://localhost:3302 38 38 7 97 1 --marker "archives/127348.html" --fixtures
 *
 * Counts are the database truth for posts / categories / tags / albums. The marker is a string from
 * the tail of one article body: finding it proves llms-full carries the whole body, not an excerpt.
 */

const base = (process.argv[2] ?? "http://localhost:3302").replace(/\/+$/u, "");
const published = Number(process.argv[3] ?? "0");
const dated = Number(process.argv[4] ?? "0");
const categories = Number(process.argv[5] ?? "0");
const tags = Number(process.argv[6] ?? "0");
const albums = Number(process.argv[7] ?? "0");
const markerIndex = process.argv.indexOf("--marker");
const marker = markerIndex < 0 ? null : process.argv[markerIndex + 1];
const withFixtures = process.argv.includes("--fixtures");

const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    console.log("ok - " + name);
  } else {
    failures.push(name);
    console.log("not ok - " + name + (detail === "" ? "" : " (" + detail + ")"));
  }
};

const get = async (path) => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(240_000) });
  const text = await response.text();
  return { contentType: response.headers.get("content-type") ?? "", status: response.status, text };
};
const count = (text, pattern) => [...text.matchAll(pattern)].length;

const sitemap = await get("/sitemap.xml");
check("sitemap.xml is 200", sitemap.status === 200);
check("sitemap.xml keeps application/xml", sitemap.contentType.startsWith("application/xml"), sitemap.contentType);
const staticPages = 11;
const expectedUrls = staticPages + published + categories + tags + albums;
check("sitemap.xml url count matches the database", count(sitemap.text, /<url>/gu) === expectedUrls, String(count(sitemap.text, /<url>/gu)) + " vs " + expectedUrls);
for (const page of ["/micro", "/projects", "/toolbox", "/changelog"]) {
  check("sitemap.xml lists " + page, sitemap.text.includes("<loc>" + base + page + "</loc>"));
}
check("sitemap.xml keeps pagination out of the sitemap", !sitemap.text.includes("?page="));
check("sitemap.xml uses one origin", !/<loc>(?!http:\/\/localhost)/u.test(sitemap.text));

const llms = await get("/llms.txt");
check("/llms.txt is 200 and text/plain", llms.status === 200 && llms.contentType === "text/plain; charset=utf-8", llms.contentType);
for (const page of ["/micro", "/projects", "/toolbox", "/changelog"]) {
  check("/llms.txt links " + page, llms.text.includes(base + page + ")"));
}
check("/llms.txt reports the article count", llms.text.includes("已发布文章: " + published + " 篇"));
check("/llms.txt lists projects", llms.text.includes("## 项目"));
check("/llms.txt lists the toolbox", llms.text.includes("## 工具箱"));
check("/llms.txt lists articles", llms.text.includes("## 文章"));

if (withFixtures) {
  check("/llms.txt has a micro section", llms.text.includes("## 微文"));
  check("/llms.txt enumerates three micro posts", llms.text.includes("（共 3 条"));
  check("/llms.txt keeps the micro tag", llms.text.includes("#h25"));
  check("/llms.txt has a changelog section", llms.text.includes("## 更新日志"));
  check("/llms.txt enumerates the changelog", llms.text.includes("v9.9.3") && llms.text.includes("（共 3 条"));
  check("/llms.txt counts fixtures", llms.text.includes("微文: 3 条") && llms.text.includes("更新日志: 3 条"));
} else {
  check("/llms.txt omits an empty micro section", !llms.text.includes("## 微文"));
  check("/llms.txt omits an empty changelog section", !llms.text.includes("## 更新日志"));
  check("/llms.txt still reports zero counts", llms.text.includes("微文: 0 条") && llms.text.includes("更新日志: 0 条"));
}

const full = await get("/llms-full.txt");
check("/llms-full.txt is 200 and text/plain", full.status === 200 && full.contentType === "text/plain; charset=utf-8", full.contentType);
check("/llms-full.txt no longer prints excerpts", !full.text.includes("正文摘要："));
check("/llms-full.txt states included/available counts", full.text.includes("文章数: " + Math.min(published, 50) + " / 全站 " + published));
if (marker !== null) {
  check("/llms-full.txt carries a body tail beyond any excerpt", full.text.includes(marker));
}
if (withFixtures) {
  check("/llms-full.txt carries micro content in full", full.text.includes("## 微文：h25-micro-01") && full.text.includes("第二行（换行应保留）"));
  check("/llms-full.txt carries changelog changes", full.text.includes("## 更新日志：v9.9.3") && full.text.includes("新增机器面页"));
  check("/llms-full.txt carries a body-only changelog", full.text.includes("只有正文的条目正文内容。"));
} else {
  check("/llms-full.txt reports empty micro", full.text.includes("微文: 0 / 全站 0"));
  check("/llms-full.txt reports empty changelog", full.text.includes("更新日志: 0 / 全站 0"));
  check("/llms-full.txt omits absent micro rows", !full.text.includes("## 微文："));
}

const itemCount = Math.min(dated, 20);
const rss = await get("/rss.xml");
check("/rss.xml keeps its content type", rss.contentType === "application/rss+xml; charset=utf-8", rss.contentType);
check("/rss.xml caps items like v2", count(rss.text, /<item>/gu) === itemCount, String(count(rss.text, /<item>/gu)));
check("/rss.xml declares the content namespace", rss.text.includes("xmlns:content="));
check("/rss.xml carries full bodies", count(rss.text, /<content:encoded>/gu) === itemCount, String(count(rss.text, /<content:encoded>/gu)));
if (marker !== null) {
  check("/rss.xml carries a body tail beyond the description", rss.text.includes(marker));
}

const atom = await get("/atom.xml");
check("/atom.xml keeps its content type", atom.contentType === "application/atom+xml; charset=utf-8", atom.contentType);
check("/atom.xml caps entries like v2", count(atom.text, /<entry>/gu) === itemCount, String(count(atom.text, /<entry>/gu)));
check("/atom.xml carries full bodies", count(atom.text, /<content type="text">/gu) === itemCount, String(count(atom.text, /<content type="text">/gu)));

console.log("");
console.log(failures.length === 0 ? "PASS " + base + (withFixtures ? " (fixtures)" : " (empty)") : "FAIL " + failures.length + " check(s)");
if (failures.length > 0) process.exitCode = 1;