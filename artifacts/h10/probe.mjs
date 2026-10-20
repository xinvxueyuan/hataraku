#!/usr/bin/env node
/**
 * H10 page probe.
 *
 * Fetches the archive, taxonomy, album and about pages from a running web instance and asserts
 * the HTML contract each one owns: semantic landmarks, focus-visible styles on in-page links,
 * image alt text, rendered data, empty states and 404s.
 *
 *   node artifacts/h10/probe.mjs http://127.0.0.1:3320
 *   node artifacts/h10/probe.mjs http://127.0.0.1:3320 --fixtures   # after fixtures.sql
 *
 * The fixture run also asserts the pagination, visibility and empty-state behaviour that the
 * migrated dataset alone cannot reach (fewer than 100 posts, no empty category, one album).
 */

const base = process.argv[2] ?? "http://127.0.0.1:3320";
const withFixtures = process.argv.includes("--fixtures");

const failures = [];
const ok = (name, condition, detail = "") => {
  if (condition) {
    console.log("ok - " + name);
  } else {
    failures.push(name);
    console.log("not ok - " + name + (detail === "" ? "" : " (" + detail + ")"));
  }
};

// React separates adjacent text nodes with an empty comment, so phrase checks read the cleaned HTML.
const clean = (html) => html.replace(/<!--[\s\S]*?-->/gu, "");

const get = async (path) => {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(240_000),
  });
  const text = await response.text();
  return { status: response.status, text, plain: clean(text) };
};

const countMatches = (text, pattern) => [...text.matchAll(pattern)].length;

const titleOf = (html) => (/<title>(.*?)<\/title>/u.exec(html) ?? [])[1] ?? "";

const assertPage = async (path, marker) => {
  const { status, text, plain } = await get(path);
  ok(path + " returns 200", status === 200, String(status));
  ok(path + " renders " + marker, plain.includes(marker));
  ok(path + " has one h1", countMatches(text, /<h1[\s>]/gu) === 1);
  ok(path + " has one main landmark", countMatches(text, /<main[\s>]/gu) === 1);
  ok(
    path + " turns focus visible on its own links",
    [...text.matchAll(/<a\b[^>]*>/gu)]
      .filter(([tag]) => /href="(?:\/posts\/|\/taxonomy|\/albums|\/archive|\/article|\/search|\/docs)/u.test(tag))
      .every(([tag]) => tag.includes("focus-visible:ring-2"))
  );
  ok(
    path + " gives every image an alt",
    [...text.matchAll(/<img\b[^>]*>/gu)].every(([tag]) => /alt="/u.test(tag))
  );
  ok(
    path + " serves images without the optimizer",
    !text.includes('src="/_next/image')
  );
  return { plain, text };
};

// --- pages that must always render, whatever the database holds -----------------------------

const archive = (await assertPage("/archive", "归档")).plain;
ok("/archive groups by year", archive.includes('aria-label="按年份跳转"'));
ok("/archive prints a time element", /<time[\s>]/u.test(archive));
ok("/archive uses no placeholder numbers", !archive.includes("NaN"));
ok("/archive title", titleOf(archive) === "归档", titleOf(archive));

const taxonomy = (await assertPage("/taxonomy", "分类与标签")).plain;
ok("/taxonomy title", titleOf(taxonomy) === "分类与标签", titleOf(taxonomy));
ok(
  "/taxonomy renders its category or tag sections",
  taxonomy.includes('data-slot="taxonomy-categories"') ||
    taxonomy.includes('data-slot="taxonomy-tags"') ||
    (taxonomy.includes("还没有分类") && taxonomy.includes("还没有标签"))
);

const albums = (await assertPage("/albums", "相册")).plain;
ok("/albums title", titleOf(albums) === "相册", titleOf(albums));
ok(
  "/albums lists albums or invites one",
  albums.includes('data-slot="album-list"') || albums.includes("还没有相册")
);

const about = (await assertPage("/about", "关于")).plain;
ok("/about title", titleOf(about) === "关于", titleOf(about));
ok("/about shows site stats", about.includes('data-slot="site-stats"'));
ok("/about shows the site map", about.includes('data-slot="site-places"'));
ok("/about does not link a missing feed", !about.includes('href="/rss.xml"'));

const frontend = (await assertPage("/taxonomy/category/frontend", "分类：Frontend")).plain;
ok(
  "/taxonomy/category/frontend lists or explains",
  frontend.includes('data-slot="taxonomy-posts"') || frontend.includes("还没有文章")
);

const performanceTag = (await assertPage("/taxonomy/tag/performance", "标签：Performance")).plain;
ok(
  "/taxonomy/tag/performance lists or explains",
  performanceTag.includes('data-slot="taxonomy-posts"') ||
    performanceTag.includes("还没有文章")
);

const nonAscii = await get("/taxonomy/category/" + encodeURIComponent("安全"));
ok("/taxonomy/category/安全 returns 200", nonAscii.status === 200, String(nonAscii.status));
ok("/taxonomy/category/安全 renders", nonAscii.plain.includes("分类：安全"));

const albumDetail = (await assertPage("/albums/acg-example", "一些可爱的图片")).plain;
ok(
  "/albums/acg-example renders photos",
  albumDetail.includes('data-slot="album-photos"')
);
ok(
  "/albums/acg-example loads photos from the media host",
  (albumDetail.match(/<img[^>]*src="https:\/\/cdn\.xinvstar\.xyz\//gu) ?? []).length > 0
);

const missingPages = [
  "/taxonomy/nope/anything",
  "/taxonomy/category/does-not-exist",
  "/taxonomy/tag/does-not-exist",
  "/albums/does-not-exist",
];
for (const path of missingPages) {
  const { status } = await get(path);
  ok(path + " is a 404", status === 404, String(status));
}

// --- fixture-only assertions ----------------------------------------------------------------

if (withFixtures) {
  ok("/archive reports the fixture total", archive.includes("140 篇文章"), "expected 140");
  ok("/archive keeps the undated bucket", archive.includes("日期待定"));
  ok("/archive lists the undated fixture", archive.includes("H10 undated post"));
  ok("/archive hides the draft fixture", !archive.includes("H10 draft post"));
  ok("/archive hides the unpublished fixture", !archive.includes("H10 unpublished post"));
  ok(
    "/archive lists every fixture post across pages",
    countMatches(archive, /href="\/posts\/h10-fixture-post-/gu) === 101,
    String(countMatches(archive, /href="\/posts\/h10-fixture-post-/gu))
  );
  ok("/archive renders 2023", archive.includes("2023 年"));
  ok("/archive renders a month heading", /<h3[^>]*>1 月<\/h3>/u.test(archive));

  ok(
    "/taxonomy reports fixture counts",
    taxonomy.includes("140 篇文章，分在 9 个分类、98 个标签里"),
    ""
  );
  ok("/taxonomy links the empty category", taxonomy.includes("/taxonomy/category/h10-empty-category"));

  const pagerOne = await get("/taxonomy/category/h10-pager-category");
  ok("/taxonomy/category/h10-pager-category paginates", pagerOne.plain.includes("第 1 / 6 页"));
  ok(
    "/taxonomy/category/h10-pager-category shows 20 rows",
    countMatches(pagerOne.plain, /<article[\s>]/gu) === 20,
    String(countMatches(pagerOne.plain, /<article[\s>]/gu))
  );
  const pagerTwo = await get("/taxonomy/category/h10-pager-category?page=2");
  ok("/taxonomy/category/h10-pager-category?page=2 shows 20 rows", countMatches(pagerTwo.plain, /<article[\s>]/gu) === 20);
  const pagerLast = await get("/taxonomy/category/h10-pager-category?page=6");
  ok("/taxonomy/category/h10-pager-category?page=6 shows the last row", countMatches(pagerLast.plain, /<article[\s>]/gu) === 1);
  const pagerBeyond = await get("/taxonomy/category/h10-pager-category?page=7");
  ok("/taxonomy/category/h10-pager-category?page=7 explains the empty page", pagerBeyond.plain.includes("这一页没有文章了"));
  ok(
    "/taxonomy/category/h10-pager-category?page=7 drops the pager",
    !pagerBeyond.plain.includes('aria-label="分类「H10 pager category」分页"')
  );

  const emptyCategory = await get("/taxonomy/category/h10-empty-category");
  ok("/taxonomy/category/h10-empty-category returns 200", emptyCategory.status === 200);
  ok(
    "/taxonomy/category/h10-empty-category invites a post",
    emptyCategory.plain.includes("这个分类下还没有文章") && emptyCategory.plain.includes("去归档看看")
  );
  const emptyTag = await get("/taxonomy/tag/h10-empty-tag");
  ok(
    "/taxonomy/tag/h10-empty-tag invites a post",
    emptyTag.plain.includes("这个标签下还没有文章")
  );

  ok("/albums reports the fixture total", albums.includes("14 本影像集"));
  ok("/albums paginate", albums.includes("第 1 / 2 页"));
  ok(
    "/albums shows twelve cards on page one",
    countMatches(albums, /href="\/albums\//gu) === 12,
    String(countMatches(albums, /href="\/albums\//gu))
  );
  const albumPageTwo = await get("/albums?page=2");
  ok(
    "/albums?page=2 shows the remaining two cards",
    countMatches(albumPageTwo.plain, /href="\/albums\/h10-fixture-album-/gu) === 2,
    String(countMatches(albumPageTwo.plain, /href="\/albums\/h10-fixture-album-/gu))
  );
  const albumBeyond = await get("/albums?page=3");
  ok("/albums?page=3 explains the empty page", albumBeyond.plain.includes("这一页没有相册了"));

  const emptyAlbum = await get("/albums/h10-fixture-album-01");
  ok(
    "/albums/h10-fixture-album-01 invites photos",
    emptyAlbum.plain.includes("这本相册还没有照片")
  );
}

console.log("");
console.log(failures.length === 0 ? "PASS " + base : "FAIL " + failures.length + " check(s) on " + base);
if (failures.length > 0) {
  process.exitCode = 1;
}
