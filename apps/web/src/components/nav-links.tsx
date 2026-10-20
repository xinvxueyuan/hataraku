"use client";

import { ChevronDown, Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { KeyboardEvent, MouseEvent, SyntheticEvent } from "react";

/**
 * The site's main navigation.
 *
 * Active state is derived from the pathname rather than passed in, so a link and its
 * `aria-current="page"` cannot disagree. Desktop keeps seven top-level items and folds the
 * browsing directories (归档 / 分类 / 相册 / 工具箱) into a "更多" disclosure; the mobile panel lists
 * every destination flat, because a disclosure inside a disclosure is worse than a longer list.
 */

interface NavItem {
  href: Route;
  isActive: (pathname: string) => boolean;
  label: string;
}

const isSection = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const HOME: NavItem = {
  href: "/",
  isActive: (pathname) => pathname === "/",
  label: "首页",
};

const ARTICLES: NavItem = {
  href: "/article",
  isActive: (pathname) =>
    isSection("/article")(pathname) || pathname.startsWith("/posts/"),
  label: "文章",
};

const MICRO: NavItem = {
  href: "/micro",
  isActive: isSection("/micro"),
  label: "微文",
};

const PROJECTS: NavItem = {
  href: "/projects",
  isActive: isSection("/projects"),
  label: "项目",
};

const CHANGELOG: NavItem = {
  href: "/changelog",
  isActive: isSection("/changelog"),
  label: "更新日志",
};

const ABOUT: NavItem = {
  href: "/about",
  isActive: (pathname) => pathname === "/about",
  label: "关于",
};

const SEARCH: NavItem = {
  href: "/search",
  isActive: isSection("/search"),
  label: "搜索",
};

/** Directories that are worth their own page but not worth a top-level slot on the bar. */
const BROWSE: NavItem[] = [
  { href: "/archive", isActive: isSection("/archive"), label: "归档" },
  { href: "/taxonomy", isActive: isSection("/taxonomy"), label: "分类" },
  { href: "/albums", isActive: isSection("/albums"), label: "相册" },
  { href: "/toolbox", isActive: isSection("/toolbox"), label: "工具箱" },
];

const BAR_LINKS = [HOME, ARTICLES, MICRO, PROJECTS, CHANGELOG, ABOUT, SEARCH];

/** Number of bar links shown before the "更多" disclosure. */
const BAR_BREAK = 5;

const MENU_LINKS = [...BAR_LINKS, ...BROWSE];

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const linkClass = (active: boolean, isBar: boolean): string =>
  [
    focusRing,
    "block rounded-md font-medium transition-colors",
    isBar ? "px-2.5 py-1" : "px-3 py-2",
    active
      ? "bg-muted text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
  ].join(" ");

const activeItem = (links: NavItem[], pathname: string): NavItem | undefined =>
  links.find((link) => link.isActive(pathname));

/**
 * A `<details>` disclosure that behaves like a popup for keyboards: opening moves focus into the
 * panel, Escape closes it and returns focus to the summary. Native details gives click, Enter and
 * Space for free; focus management is the part it does not.
 */
/** A click on a destination closes the panel that held it; the header survives client navigation. */
const closePanel = (event: MouseEvent<HTMLAnchorElement>) => {
  const details = event.currentTarget.closest("details");

  if (details !== null) {
    details.open = false;
  }
};

const disclosureHandlers = {
  onKeyDown: (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !event.currentTarget.open) {
      return;
    }

    event.preventDefault();
    event.currentTarget.open = false;
    event.currentTarget.querySelector<HTMLElement>("summary")?.focus();
  },
  onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open) {
      event.currentTarget.querySelector<HTMLElement>("a[href]")?.focus();
    }
  },
};

const NavLink = ({
  active,
  isBar,
  item,
}: {
  active: boolean;
  isBar: boolean;
  item: NavItem;
}) => (
  <li>
    <Link
      aria-current={active ? "page" : undefined}
      className={linkClass(active, isBar)}
      href={item.href}
      onClick={closePanel}
    >
      {item.label}
    </Link>
  </li>
);

const MoreMenu = ({ currentPath }: { currentPath: string }) => {
  const groupIsActive = activeItem(BROWSE, currentPath) !== undefined;

  return (
    <details className="relative" {...disclosureHandlers}>
      <summary
        className={[
          focusRing,
          "flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1 font-medium [&::-webkit-details-marker]:hidden",
          groupIsActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        ].join(" ")}
      >
        更多
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div
        className="bg-popover absolute top-full left-0 z-30 mt-2 w-40 rounded-lg border p-2 shadow-lg"
      >
        <ul className="flex flex-col gap-1 text-sm">
          {BROWSE.map((link) => (
            <li key={link.href}>
              <Link
                aria-current={link.isActive(currentPath) ? "page" : undefined}
                className={linkClass(link.isActive(currentPath), false)}
                href={link.href}
                onClick={closePanel}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
};

export const NavLinks = ({
  label = "主导航",
  variant = "bar",
}: {
  label?: string;
  variant?: "bar" | "menu";
}) => {
  const pathname = usePathname();
  const isBar = variant === "bar";
  const links = isBar ? BAR_LINKS : MENU_LINKS;
  const before = isBar ? links.slice(0, BAR_BREAK) : links;
  const after = isBar ? links.slice(BAR_BREAK) : [];

  return (
    <nav aria-label={label}>
      <ul
        className={
          isBar
            ? "flex items-center gap-1 text-sm"
            : "flex flex-col gap-1 text-sm"
        }
      >
        {before.map((link) => (
          <NavLink
            active={link.isActive(pathname)}
            isBar={isBar}
            item={link}
            key={link.href}
          />
        ))}
        {isBar ? (
          <li>
            <MoreMenu currentPath={pathname} />
          </li>
        ) : null}
        {after.map((link) => (
          <NavLink
            active={link.isActive(pathname)}
            isBar={isBar}
            item={link}
            key={link.href}
          />
        ))}
      </ul>
    </nav>
  );
};

/** The narrow-screen disclosure that holds the full menu. */
export const MobileNav = () => (
  <details className="relative md:hidden" {...disclosureHandlers}>
    <summary
      className={`${focusRing} border-border flex cursor-pointer list-none items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
    >
      <Menu aria-hidden="true" className="size-4" />
      菜单
    </summary>
    <div className="bg-popover absolute top-full right-0 z-30 mt-2 w-44 rounded-lg border p-2 shadow-lg">
      <NavLinks label="主导航（移动）" variant="menu" />
    </div>
  </details>
);