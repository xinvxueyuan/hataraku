import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Button } from "@hataraku/ui/components/button";
import { Input } from "@hataraku/ui/components/input";

/**
 * The site's 404.
 *
 * `notFound()` from a page, an unmatched URL, and a retired taxonomy slug all land here, so it has
 * to answer "what now" and not only "no": a search field that works without JavaScript (a GET
 * form) and the four entrances a reader most often wants.
 */

export const metadata: Metadata = { title: "页面不存在" };

const PLACES = [
  { description: "从最新一篇读起。", href: "/", label: "首页" },
  { description: "按时间排列的全部文章。", href: "/blog", label: "写作" },
  { description: "站点的实现说明。", href: "/docs", label: "文档" },
  { description: "按发布月份往回翻。", href: "/blog/archive", label: "归档" },
] as const;

const NotFound = () => (
  <div
    className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16"
    data-slot="not-found"
  >
    <header className="flex flex-col gap-3">
      <p className="text-muted-foreground font-mono text-sm tracking-widest">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">这一页不存在</h1>
      <p className="text-muted-foreground">
        链接可能过期了，或者地址打错了一个字。搜一下关键词，或者从下面挑个入口继续读。
      </p>
    </header>

    <form action="/search" className="flex w-full max-w-md gap-2" method="get">
      <label className="sr-only" htmlFor="not-found-query">
        搜索关键词
      </label>
      <Input
        className="flex-1"
        id="not-found-query"
        name="q"
        placeholder="输入关键词"
        type="search"
      />
      <Button type="submit" variant="outline">
        搜索
      </Button>
    </form>

    <nav aria-label="常用入口" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        常用入口
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PLACES.map((place) => (
          <li key={place.href}>
            <Link
              className={`${focusRing} hover:bg-accent flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors`}
              href={place.href}
            >
              <span className="font-medium">{place.label}</span>
              <span className="text-muted-foreground text-sm">
                {place.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  </div>
);

export default NotFound;
