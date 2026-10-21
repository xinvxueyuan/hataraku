import Link from "next/link";

import { ApiStatusPill } from "#src/components/api-status-pill.tsx";
import { loadSiteIdentity } from "#src/components/site-content.ts";

const focusRing =
  "rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const SITE_LINKS = [
  { href: "/", label: "首页" },
  { href: "/article", label: "文章" },
  { href: "/micro", label: "微文" },
  { href: "/projects", label: "项目" },
  { href: "/changelog", label: "更新日志" },
  { href: "/archive", label: "归档" },
  { href: "/taxonomy", label: "分类与标签" },
  { href: "/albums", label: "相册" },
  { href: "/toolbox", label: "工具箱" },
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

export const SiteFooter = async () => {
  const site = await loadSiteIdentity();

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{site.title}</span>
          <span className="text-muted-foreground max-w-xs text-xs">
            {site.description}
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

      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 pb-6 text-xs">
        <span>© {site.name} · 把代码、学习与生活写成可读的记录</span>
        <ApiStatusPill />
      </div>
    </footer>
  );
};
