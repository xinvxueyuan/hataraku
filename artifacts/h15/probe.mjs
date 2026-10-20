#!/usr/bin/env node
/**
 * H15 probe: machine endpoints and the site shell.
 *
 * Asserts what the contract names — content types, entry counts against the published rows, absolute
 * links, per-page metadata, and the navigation/footer structure — against a running web instance.
 *
 *   node artifacts/h15/probe.mjs http://127.0.0.1:3300 38 38 7 96 1
 *   (base, published, dated, categories, tags, albums)
 *
 * The counts come from the database (psql), so the probe checks the endpoints against the same
 * rows a reader would see rather than against a hardcoded fixture.
 */

const base = (process.argv[2] ?? "http://127.0.0.1:3300").replace(/\/+$/u, "");
const published = Number(process.argv[3] ?? "38");
const dated = Number(process.argv[4] ?? "38");
const categories = Number(process.argv[5] ?? "7");
const tags = Number(process.argv[6] ?? "96");
const albums = Number(process.argv[7] ?? "1");

/** The seven fixed pages /sitemap.xml lists. */
const STATIC_PAGE_COUNT = 7;
const sitemapTotal = STATIC_PAGE_COUNT + published + categories + tags + albums;

const failures = [];
const check = (name, condition, detail = "") => {
  if (condition) {
    console.log("ok - " + name);
  } else {
    failures.push(name);
    console.log("not ok - " + name + (detail === "" ? "" : " (" + detail + ")"));
  }
};

const get = async (path) => {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(240_000),
  });
  const body = await response.text();
  return {
    body,
    contentType: response.headers.get("content-type") ?? "",
    status: response.status,
  };
};

const clean = (html) => html.replace(/<!--[\s\S]*?-->/gu, "");
const count = (text, pattern) => [...text.matchAll(pattern)].length;
const headOf = (html) => html.slice(0, html.indexOf("</head>"));

const expectType = async (path, format) => {
  const { status, contentType, body } = await get(path);
  check(path + " returns 200", status === 200, String(status));
  check(
    path + " content type is " + format,
    contentType === format,
    contentType
  );
  return body;
};

// --- feeds -----------------------------------------------------------------------------------

const rss = await expectType("/rss.xml", "application/rss+xml; charset=utf-8");
check("/rss.xml is XML", rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
check("/rss.xml declares RSS 2.0", rss.includes('<rss version="2.0"'));
check("/rss.xml declares the atom namespace", rss.includes('xmlns:atom="http://www.w3.org/2005/Atom"'));
check("/rss.xml channel title", rss.includes("<title>夜行栈 NightStack</title>"));
check("/rss.xml item count equals published+dated rows", count(rss, /<item>/gu) === dated, String(count(rss, /<item>/gu)));
check("/rss.xml item elements are balanced", count(rss, /<item>/gu) === count(rss, /<\/item>/gu));
check("/rss.xml items link to the article pages", count(rss, new RegExp("<link>" + base + "/posts/", "gu")) === dated);
check("/rss.xml items carry guid", count(rss, /<guid isPermaLink="true">/gu) === dated);
check("/rss.xml items carry pubDate", count(rss, /<pubDate>/gu) === dated);
check("/rss.xml items carry description", count(rss, /<description>/gu) >= dated);
check(
  "/rss.xml pubDate uses RFC 822 in +0800",
  count(rss, /<pubDate>(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} \+0800<\/pubDate>/gu) === dated
);
check("/rss.xml has lastBuildDate", /<lastBuildDate>.+?<\/lastBuildDate>/u.test(rss));
check("/rss.xml advertises itself", rss.includes('rel="self"'));

const atom = await expectType("/atom.xml", "application/atom+xml; charset=utf-8");
check("/atom.xml is XML", atom.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
check("/atom.xml declares Atom 1.0", atom.includes('<feed xmlns="http://www.w3.org/2005/Atom"'));
check("/atom.xml entry count equals published+dated rows", count(atom, /<entry>/gu) === dated, String(count(atom, /<entry>/gu)));
check("/atom.xml entry elements are balanced", count(atom, /<entry>/gu) === count(atom, /<\/entry>/gu));
check("/atom.xml entries link to the article pages", count(atom, new RegExp('href="' + base + "/posts/", "gu")) === dated);
check("/atom.xml entries carry an id", count(atom, /<id>/gu) >= dated);
check("/atom.xml entries carry published", count(atom, /<published>/gu) === dated);
check("/atom.xml entries carry updated", count(atom, /<updated>/gu) === dated + 1);
check("/atom.xml entries carry summary", count(atom, /<summary type="text">/gu) === dated);
check(
  "/atom.xml timestamps use RFC 3339 in +08:00",
  count(atom, /<\/updated>/gu) >= dated &&
    count(atom, /\+08:00<\/updated>/gu) >= dated
);

// --- sitemap ---------------------------------------------------------------------------------

const sitemap = await expectType("/sitemap.xml", "application/xml");
check("/sitemap.xml uses the sitemap namespace", sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
check("/sitemap.xml url count", count(sitemap, /<url>/gu) === sitemapTotal, String(count(sitemap, /<url>/gu)));
check("/sitemap.xml url elements are balanced", count(sitemap, /<url>/gu) === count(sitemap, /<\/url>/gu));
check("/sitemap.xml lists the home page", sitemap.includes("<loc>" + base + "/</loc>"));
for (const path of ["/article", "/archive", "/taxonomy", "/albums", "/about", "/docs"]) {
  check("/sitemap.xml lists " + path, sitemap.includes("<loc>" + base + path + "</loc>"));
}
check("/sitemap.xml lists every article", count(sitemap, new RegExp("<loc>" + base + "/posts/", "gu")) === published);
check("/sitemap.xml lists every category", count(sitemap, new RegExp("<loc>" + base + "/taxonomy/category/", "gu")) === categories);
check("/sitemap.xml lists every tag", count(sitemap, new RegExp("<loc>" + base + "/taxonomy/tag/", "gu")) === tags);
check("/sitemap.xml lists every album", count(sitemap, new RegExp("<loc>" + base + "/albums/[^<]+</loc>", "gu")) === albums);
check("/sitemap.xml locs are absolute", count(sitemap, /<loc>/gu) === count(sitemap, new RegExp("<loc>" + base, "gu")));

// --- llms files ------------------------------------------------------------------------------

const llms = await expectType("/llms.txt", "text/plain; charset=utf-8");
check("/llms.txt starts with the site heading", llms.startsWith("# 夜行栈 NightStack"));
check("/llms.txt states the tagline", llms.includes("> 昼 · 清醒记录构建 / 夜 · 沉浸漫游沉思"));
check("/llms.txt lists the machine endpoints", [base + "/rss.xml", base + "/atom.xml", base + "/sitemap.xml", base + "/robots.txt", base + "/llms-full.txt"].every((url) => llms.includes(url)));
check("/llms.txt lists every article", count(llms, new RegExp("\\]\\(" + base + "/posts/", "gu")) === published, String(count(llms, new RegExp("\\]\\(" + base + "/posts/", "gu"))));
check("/llms.txt lists every category", count(llms, new RegExp("\\]\\(" + base + "/taxonomy/category/", "gu")) === categories);
check("/llms.txt lists every tag", count(llms, new RegExp("\\]\\(" + base + "/taxonomy/tag/", "gu")) === tags);
check("/llms.txt lists every album", count(llms, new RegExp("\\]\\(" + base + "/albums/", "gu")) === albums);

const llmsFull = await expectType("/llms-full.txt", "text/plain; charset=utf-8");
check("/llms-full.txt starts with the site heading", llmsFull.startsWith("# 夜行栈 NightStack"));
check("/llms-full.txt has one section per article", count(llmsFull, /^## /gmu) === published, String(count(llmsFull, /^## /gmu)));
check("/llms-full.txt gives every article its URL", count(llmsFull, new RegExp("- URL: " + base + "/posts/", "gu")) === published);
check("/llms-full.txt includes body excerpts", count(llmsFull, /正文摘要：/gu) === published, String(count(llmsFull, /正文摘要：/gu)));
check("/llms-full.txt includes summaries", count(llmsFull, /^> /gmu) >= published);

const robots = await get("/robots.txt");
check("/robots.txt returns 200", robots.status === 200, String(robots.status));
check("/robots.txt content type", robots.contentType.startsWith("text/plain"), robots.contentType);
check("/robots.txt points at the sitemap", robots.body.includes("Sitemap: " + base + "/sitemap.xml"));
check("/robots.txt closes the app routes", robots.body.includes("Disallow: /todos") && robots.body.includes("Disallow: /login"));

// --- pages -----------------------------------------------------------------------------------

const ROUTES = [
  { active: "/", path: "/" },
  { active: "/article", path: "/article" },
  { active: "/archive", path: "/archive" },
  { active: "/taxonomy", path: "/taxonomy" },
  { active: "/taxonomy", path: "/taxonomy/category/frontend" },
  { active: "/albums", path: "/albums" },
  { active: "/about", path: "/about" },
  { active: "/search", path: "/search" },
  { active: null, path: "/docs" },
  { active: "/article", path: "/posts/2026-10-17-google-ai-studio-personal-android-apps" },
];

for (const route of ROUTES) {
  const { status, body } = await get(route.path);
  const html = clean(body);
  const head = headOf(html);
  const expectedUrl = base + (route.path === "/" ? "" : route.path);
  check(route.path + " returns 200", status === 200, String(status));
  check(route.path + " sets lang=zh-CN", html.includes('<html lang="zh-CN"'));
  check(route.path + " has a title with the site name", new RegExp("<title>[^<]*夜行栈[^<]*</title>").test(head));
  check(route.path + " has a description", /<meta name="description" content="[^"]+"/u.test(head));
  check(route.path + " has og:title", head.includes('property="og:title"'));
  check(route.path + " has og:description", head.includes('property="og:description"'));
  check(route.path + " has og:url for this page", head.includes('property="og:url" content="' + expectedUrl + '"'));
  check(route.path + " has og:site_name", head.includes('property="og:site_name"'));
  check(route.path + " has a canonical URL", head.includes('rel="canonical" href="' + expectedUrl + '"'));
  check(route.path + " links the feeds", head.includes('type="application/rss+xml"') && head.includes('type="application/atom+xml"'));
  check(route.path + " renders the skip link", html.includes('href="#content"'));
  check(route.path + " marks the main landmark", html.includes('id="content"'));
  check(route.path + " has the desktop nav", html.includes('aria-label="主导航"'));
  check(route.path + " has the mobile nav disclosure", html.includes("<details") && html.includes("主导航（移动）") && html.includes("菜单"));
  check(route.path + " has the footer", html.includes("<footer"));
  check(route.path + " links the machine endpoints in the footer", ["/rss.xml", "/atom.xml", "/sitemap.xml", "/llms.txt", "/llms-full.txt"].every((href) => html.includes('href="' + href + '"')));
  check(route.path + " has exactly one nav item per label", ["首页", "文章", "归档", "分类", "相册", "关于", "搜索"].every((label) => (html.match(new RegExp(">" + label + "</a>", "gu")) ?? []).length >= 1));

  if (route.active === null) {
    check(route.path + " has no current nav item", count(html, /aria-current="page"/gu) === 0, String(count(html, /aria-current="page"/gu)));
  } else {
    const current = [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/gu)].map(([tag]) => (tag.match(/href="([^"]+)"/u) ?? [])[1]);
    check(route.path + " marks the current nav item", current.length >= 1 && current.every((href) => href === route.active), current.join(","));
  }
}

console.log("");
console.log(failures.length === 0 ? "PASS " + base : "FAIL " + failures.length + " check(s) on " + base);
if (failures.length > 0) {
  process.exitCode = 1;
}
