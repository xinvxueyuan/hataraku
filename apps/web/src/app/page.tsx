import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { ModuleTile } from "@hataraku/components/module-tile";

import { PortalHero } from "#src/components/portal-hero.tsx";
import { loadSiteProfile } from "#src/components/site-content.ts";
import { loadPortalModules } from "#src/server/portal.ts";

/**
 * The portal home: identity, the newest signals, and one tile per content module.
 *
 * The page reads two server aggregates and renders no client state; the poster and identity are
 * editorial, the tiles are the shared ModuleTile, and modules with nothing in them do not appear.
 */
export const metadata: Metadata = {
  description: "夜行栈：写作、文档、项目与生活碎片的个人融合门户。",
};

const OTHER_LINKS = [
  { href: "/notes", label: "微言" },
  { href: "/changelog", label: "更新日志" },
  { href: "/toolbox", label: "工具箱" },
  { href: "/blog/archive", label: "归档" },
  { href: "/blog/taxonomy", label: "分类" },
] as const;

const HomePage = async () => {
  const [profile, modules] = await Promise.all([
    loadSiteProfile(),
    loadPortalModules(),
  ]);

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12"
      data-slot="portal"
    >
      <PortalHero modules={modules} profile={profile} />

      <section
        aria-labelledby="modules-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2
            className="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
            id="modules-heading"
          >
            模块
          </h2>
          <span className="text-muted-foreground text-xs">
            只列出已有内容的模块
          </span>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <ModuleTile
              count={module.count}
              countUnit={module.countUnit}
              href={module.href}
              key={module.key}
              label={module.label}
              latest={module.latest}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="other-heading" className="flex flex-col gap-3">
        <h2
          className="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
          id="other-heading"
        >
          其余入口
        </h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {OTHER_LINKS.map((link) => (
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
      </section>
    </div>
  );
};

export default HomePage;
