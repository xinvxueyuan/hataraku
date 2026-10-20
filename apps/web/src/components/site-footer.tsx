import Link from "next/link";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from "#src/components/site.ts";

const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const SITE_LINKS = [
  { href: "/", label: "首页" },
  { href: "/article", label: "文章" },
  { href: "/archive", label: "归档" },
  { href: "/taxonomy", label: "分类与标签" },
  { href: "/albums", label: "相册" },
  { href: "/about", label: "关于" },
  { href: "/docs", label: "文档" },
  { href: "/search", label: "搜索" },
] as const;

/** Route handlers have no page route, so these are plain anchors with no client navigation. */
const FEED_LINKS = [
  { href: "/rss.xml", label: "RSS" },
  { href: "/atom.xml", label: "Atom" },
  { href: "/sitemap.xml", label: "Sitemap" },
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/llms-full.txt", label: "llms-full.txt" },
] as const;

export const SiteFooter = () => (
  <footer className="border-t">
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{SITE_TITLE}</span>
        <span className="text-muted-foreground max-w-xs text-xs">
          {SITE_DESCRIPTION}
        </span>
      </div>

      <nav aria-label="页脚导航">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {SITE_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                className={`${focusRing} text-muted-foreground hover:text-foreground underline-offset-4 hover:underline`}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="订阅与机器端点">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {FEED_LINKS.map((link) => (
            <li key={link.href}>
              <a
                className={`${focusRing} text-muted-foreground hover:text-foreground underline-offset-4 hover:underline`}
                href={link.href}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>

    <div className="text-muted-foreground mx-auto max-w-5xl px-4 pb-6 text-xs">
      © {SITE_NAME} · 内容与装备数据来自 Postgres
    </div>
  </footer>
);
