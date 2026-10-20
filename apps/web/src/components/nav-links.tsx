"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The site's main navigation.
 *
 * Active state is derived from the pathname rather than passed in, so a link and its
 * `aria-current="page"` cannot disagree. Two layouts share the same items: a horizontal bar for
 * the header and a vertical list for the mobile disclosure panel.
 */

type NavVariant = "bar" | "menu";

const LINKS = [
  {
    href: "/",
    isActive: (pathname: string) => pathname === "/",
    label: "首页",
  },
  {
    href: "/article",
    isActive: (pathname: string) =>
      pathname === "/article" || pathname.startsWith("/posts/"),
    label: "文章",
  },
  {
    href: "/archive",
    isActive: (pathname: string) => pathname.startsWith("/archive"),
    label: "归档",
  },
  {
    href: "/taxonomy",
    isActive: (pathname: string) => pathname.startsWith("/taxonomy"),
    label: "分类",
  },
  {
    href: "/albums",
    isActive: (pathname: string) => pathname.startsWith("/albums"),
    label: "相册",
  },
  {
    href: "/about",
    isActive: (pathname: string) => pathname === "/about",
    label: "关于",
  },
  {
    href: "/search",
    isActive: (pathname: string) => pathname.startsWith("/search"),
    label: "搜索",
  },
] as const;

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export const NavLinks = ({
  label = "主导航",
  variant = "bar",
}: {
  label?: string;
  variant?: NavVariant;
}) => {
  const pathname = usePathname();
  const isBar = variant === "bar";

  return (
    <nav aria-label={label}>
      <ul
        className={
          isBar
            ? "flex items-center gap-1 text-sm"
            : "flex flex-col gap-1 text-sm"
        }
      >
        {LINKS.map((link) => {
          const active = link.isActive(pathname);

          return (
            <li key={link.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={[
                  focusRing,
                  "block rounded-md font-medium transition-colors",
                  isBar ? "px-2.5 py-1" : "px-3 py-2",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                ].join(" ")}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
