#!/usr/bin/env node
/**
 * H28 probe: dynamic OG card, /about timeline and /toolbox friends.
 *
 *   node artifacts/h28/probe.mjs http://localhost:3302            # empty tables
 *   node artifacts/h28/probe.mjs http://localhost:3302 --fixtures # after fixtures.sql
 */

const base = (process.argv[2] ?? "http://localhost:3302").replace(/\/+$/u, "");
const withFixtures = process.argv.includes("--fixtures");
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log("ok - " + name);
  else {
    failures.push(name);
    console.log("not ok - " + name + (detail === "" ? "" : " (" + detail + ")"));
  }
};

const get = async (path) => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(240_000) });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType: response.headers.get("content-type") ?? "", status: response.status };
};
const text = async (path) => (await get(path)).buffer.toString("utf8");

const pngSize = (buffer) => ({
  height: buffer.readUInt32BE(20),
  signature: buffer.subarray(1, 4).toString("ascii"),
  width: buffer.readUInt32BE(16),
});

const card = await get("/api/og?title=" + encodeURIComponent("中文标题：夜行栈动态 OG") + "&description=" + encodeURIComponent("像素统计证明不是空白卡片") + "&category=" + encodeURIComponent("测试") + "&date=2026-10-21");
check("og returns 200 image/png", card.status === 200 && card.contentType === "image/png", card.contentType);
check("og payload is a PNG", pngSize(card.buffer).signature === "PNG");
check("og is 1200x630", pngSize(card.buffer).width === 1200 && pngSize(card.buffer).height === 630, JSON.stringify(pngSize(card.buffer)));
check("og carries real bytes", card.buffer.length > 5000, String(card.buffer.length));

const hostile = "x".repeat(300) + "<script>alert(1)</script>\u0007";
const hostileCard = await get("/api/og?title=" + encodeURIComponent(hostile) + "&description=" + encodeURIComponent(hostile) + "&category=" + encodeURIComponent(hostile));
check("og clamps hostile input without failing", hostileCard.status === 200 && pngSize(hostileCard.buffer).width === 1200);

const sitemap = await text("/sitemap.xml");
const slug = (sitemap.match(/\/posts\/([^<]+)<\/loc>/u) ?? [])[1] ?? "";
check("found a post to check", slug !== "");
if (slug !== "") {
  const page = await text("/posts/" + slug);
  const image = (page.match(/property="og:image" content="([^"]+)"/u) ?? [])[1] ?? "";
  check("article og:image is absolute", image.startsWith(base + "/api/og?"), image.slice(0, 80));
  check("article og:image carries the title", image.includes("title="));
  const fetched = await get(new URL(image.replaceAll("&amp;", "&")).pathname + new URL(image.replaceAll("&amp;", "&")).search);
  check("article og:image resolves to a 1200x630 PNG", fetched.status === 200 && fetched.contentType === "image/png" && pngSize(fetched.buffer).width === 1200 && pngSize(fetched.buffer).height === 630);
}

const about = await text("/about");
const toolbox = await text("/toolbox");
if (withFixtures) {
  check("/about renders the timeline", about.includes('data-slot="site-timeline"'));
  check("/about renders a milestone", about.includes("站点迁移到新栈") && about.includes("里程碑"));
  check("/about formats the timeline date", about.includes("2026年10月21日"));
  check("/toolbox renders friends", toolbox.includes('data-slot="friend-list"'));
  check("/toolbox renders a friend", toolbox.includes("示例友链甲") && toolbox.includes("一个同样在写技术博客的站点。"));
  check("/toolbox counts friends", toolbox.includes("位朋友"));
} else {
  check("/about shows the timeline empty state", about.includes("时间线还没有记录"));
  check("/about has no timeline list", !about.includes('data-slot="site-timeline"'));
  check("/toolbox shows the friends empty state", toolbox.includes("还没有友链"));
  check("/toolbox has no friend list", !toolbox.includes('data-slot="friend-list"'));
}

console.log("");
console.log(failures.length === 0 ? "PASS " + base + (withFixtures ? " (fixtures)" : " (empty)") : "FAIL " + failures.length + " check(s)");
if (failures.length > 0) process.exitCode = 1;
