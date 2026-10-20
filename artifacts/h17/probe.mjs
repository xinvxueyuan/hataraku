#!/usr/bin/env node
/**
 * H17 probe: the four restored public pages, plus the H15 endpoints they share the origin with.
 *
 *   node artifacts/h17/probe.mjs http://localhost:3300 --fixtures   # after fixtures.sql
 *   node artifacts/h17/probe.mjs http://localhost:3300              # migrated data only
 *
 * Fixture mode checks populated lists, pagination and field rendering; baseline mode checks that
 * empty tables render an invitation instead of failing.
 */

const base = (process.argv[2] ?? "http://localhost:3300").replace(/\/+$/u, "");
const withFixtures = process.argv.includes("--fixtures");

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
  const text = await response.text();
  return {
    contentType: response.headers.get("content-type") ?? "",
    plain: text.replace(/<!--[\s\S]*?-->/gu, ""),
    status: response.status,
    text,
  };
};

const count = (text, pattern) => [...text.matchAll(pattern)].length;
const titleOf = (html) => (/<title>(.*?)<\/title>/u.exec(html) ?? [])[1] ?? "";
const headOf = (html) => html.slice(0, html.indexOf("</head>"));

const mainOf = (html) => {
  const start = html.indexOf("<main");
  const end = html.indexOf("</main>", start);

  return start < 0 || end < 0 ? "" : html.slice(start, end);
};

const assertPage = async (path, heading) => {
  const page = await get(path);
  check(path + " returns 200", page.status === 200, String(page.status));
  check(path + " renders the heading", page.text.includes(heading));
  check(path + " has one h1", count(page.text, /<h1[\s>]/gu) === 1);
  check(path + " has one main landmark", count(page.text, /<main[\s>]/gu) === 1);
  check(path + " title carries the site name", titleOf(page.text).includes("夜行栈"));
  const head = headOf(page.text);
  check(path + " has a description", /<meta name="description" content="[^"]+"/u.test(head));
  const expectedUrl = base + path.split("?")[0];
  check(path + " canonical is absolute for this page", head.includes('rel="canonical" href="' + expectedUrl + '"'));
  check(path + " og:url is absolute for this page", head.includes('property="og:url" content="' + expectedUrl + '"'));
  check(
    path + " shows focus on its links",
    [...mainOf(page.text).matchAll(/<a\b[^>]*>/gu)]
      .filter(([tag]) => /href="(?:\/micro|\/projects|\/toolbox|\/changelog|\/taxonomy|\/archive|\/article|\/about|\/)/u.test(tag))
      .every(([tag]) => tag.includes("focus-visible:ring-2"))
  );
  check(
    path + " gives every image an alt",
    [...page.text.matchAll(/<img\b[^>]*>/gu)].every(([tag]) => /alt="/u.test(tag))
  );
  return page;
};

const pager = (page) => (page.plain.match(/第 \d+ \/ \d+ 页/u) ?? [""])[0];

// --- fixture mode: populated lists -----------------------------------------------------------

if (withFixtures) {
  const micro = await assertPage("/micro", "微动态");
  check("/micro reports 23 fragments", micro.plain.includes("23 条碎片"));
  check("/micro renders ten fragments on page one", count(micro.text, /<article[\s>]/gu) === 10, String(count(micro.text, /<article[\s>]/gu)));
  check("/micro paginates", pager(micro) === "第 1 / 3 页", pager(micro));
  check("/micro preserves line breaks", micro.text.includes("whitespace-pre-line"));
  check("/micro renders the type badge", micro.plain.includes("随记") && micro.plain.includes("代码"));
  check("/micro links tags into the taxonomy", micro.text.includes('href="/taxonomy/tag/h17"'));
  check("/micro renders an uploaded image with alt", micro.text.includes('alt="h17-micro-01 的配图 1"'));
  check("/micro renders music metadata", micro.plain.includes("Fixture Track — H17"));
  check("/micro shows a listening link", micro.text.includes("收听这首"));
  const microLast = await get("/micro?page=3");
  check("/micro?page=3 has the remaining three", count(microLast.text, /<article[\s>]/gu) === 3);
  check("/micro?page=3 paginates", pager(microLast) === "第 3 / 3 页");

  const projects = await assertPage("/projects", "项目");
  check("/projects reports 13 projects", projects.plain.includes("共 13 个项目"));
  check("/projects renders twelve cards on page one", count(projects.text, /<article[\s>]/gu) === 12, String(count(projects.text, /<article[\s>]/gu)));
  check("/projects paginates", pager(projects) === "第 1 / 2 页", pager(projects));
  check("/projects renders status labels", projects.plain.includes("筹备中") && projects.plain.includes("进行中"));
  check("/projects renders a featured badge", projects.plain.includes("精选"));
  check("/projects links out safely", projects.text.includes('rel="noopener noreferrer"'));
  check("/projects renders a cover image with alt", projects.text.includes('alt="H17 fixture project 1 的封面"'));
  const projectsLast = await get("/projects?page=2");
  check("/projects?page=2 has the last card", count(projectsLast.text, /<article[\s>]/gu) === 1);

  const toolbox = await assertPage("/toolbox", "工具箱");
  check("/toolbox counts tools, devices and skills", toolbox.plain.includes("13 个工具 · 2 台设备 · 5 项技能"));
  check("/toolbox renders twelve tools and two devices on page one", count(toolbox.text, /<article[\s>]/gu) === 14, String(count(toolbox.text, /<article[\s>]/gu)));
  check("/toolbox paginates tools", pager(toolbox) === "第 1 / 2 页", pager(toolbox));
  check("/toolbox renders devices", toolbox.text.includes('data-slot="device-list"') && toolbox.plain.includes("iQOO Neo 10 Pro+"));
  check("/toolbox renders device specs", toolbox.plain.includes("灰色，32 GB + 512 GB"));
  check("/toolbox renders device images with alt", toolbox.text.includes('alt="iQOO Neo 10 Pro+ 的照片"'));
  check("/toolbox groups skills", toolbox.plain.includes("后端") && toolbox.plain.includes("数据库") && toolbox.plain.includes("前端"));
  const toolboxLast = await get("/toolbox?page=2");
  check("/toolbox?page=2 has the last tool", toolboxLast.plain.includes("H17 fixture tool 13"));

  const changelog = await assertPage("/changelog", "更新日志");
  check("/changelog reports 21 releases", changelog.plain.includes("共 21 次版本记录"));
  check("/changelog renders ten entries on page one", count(changelog.text, /<article[\s>]/gu) === 10, String(count(changelog.text, /<article[\s>]/gu)));
  check("/changelog paginates", pager(changelog) === "第 1 / 3 页", pager(changelog));
  check("/changelog highlights a release", changelog.plain.includes("重点版本"));
  check("/changelog renders the change list", changelog.text.includes("<ul class=") && changelog.plain.includes("Fixture change 1"));
  const changelogLast = await get("/changelog?page=3");
  check("/changelog?page=3 has the body-only entry", changelogLast.plain.includes("Fixture body used when an entry has no structured changes."));
  check("/changelog?page=3 marks no highlight badge", !changelogLast.plain.includes("重点版本"));
} else {
  const micro = await assertPage("/micro", "微动态");
  check("/micro reports no fragments", micro.plain.includes("0 条碎片"));
  check("/micro invites the first fragment", micro.plain.includes("还没有微动态"));
  check("/micro has no pager when empty", pager(micro) === "");

  const projects = await assertPage("/projects", "项目");
  check("/projects reports two projects", projects.plain.includes("共 2 个项目"));
  check("/projects renders two cards", count(projects.text, /<article[\s>]/gu) === 2, String(count(projects.text, /<article[\s>]/gu)));
  check("/projects has no pager for one page", pager(projects) === "");

  const toolbox = await assertPage("/toolbox", "工具箱");
  check("/toolbox reports no tools yet", toolbox.plain.includes("0 个工具 · 2 台设备 · 5 项技能"));
  check("/toolbox invites the first tool", toolbox.plain.includes("还没有收录工具"));
  check("/toolbox still renders devices and skills", toolbox.plain.includes("iQOO Neo 10 Pro+") && toolbox.plain.includes("TypeScript"));

  const changelog = await assertPage("/changelog", "更新日志");
  check("/changelog reports no releases", changelog.plain.includes("0 次版本记录"));
  check("/changelog invites the first release", changelog.plain.includes("还没有更新记录"));
  check("/changelog has no pager when empty", pager(changelog) === "");
}

// --- the H15 endpoints share the same request-derived origin ---------------------------------

const rss = await get("/rss.xml");
check("/rss.xml keeps its content type", rss.contentType === "application/rss+xml; charset=utf-8", rss.contentType);
check("/rss.xml links are absolute on this origin", count(rss.text, new RegExp("<link>" + base + "/posts/", "gu")) > 0);
const atom = await get("/atom.xml");
check("/atom.xml keeps its content type", atom.contentType === "application/atom+xml; charset=utf-8", atom.contentType);
check("/atom.xml links are absolute on this origin", atom.text.includes('href="' + base + "/posts/"));
const sitemap = await get("/sitemap.xml");
check("/sitemap.xml keeps its content type", sitemap.contentType === "application/xml", sitemap.contentType);
check("/sitemap.xml locs are absolute on this origin", sitemap.text.includes("<loc>" + base + "/</loc>"));
const llms = await get("/llms.txt");
check("/llms.txt keeps its content type", llms.contentType === "text/plain; charset=utf-8", llms.contentType);
check("/llms.txt uses this origin", llms.text.includes(base + "/rss.xml"));
const robots = await get("/robots.txt");
check("/robots.txt names this origin", robots.text.includes("Sitemap: " + base + "/sitemap.xml"), robots.text.split("\n").slice(0, 4).join(" / "));

console.log("");
console.log(failures.length === 0 ? "PASS " + base : "FAIL " + failures.length + " check(s) on " + base);
if (failures.length > 0) {
  process.exitCode = 1;
}