"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDisclosure } from "@hataraku/components/use-disclosure";

/** The settings surfaces. Naming them as literals is what keeps `<Link href>` type-checked. */
export type AdminPath =
  | "/settings/admin"
  | "/settings/admin/changelog"
  | "/settings/admin/micro"
  | "/settings/admin/posts"
  | "/settings/admin/profile"
  | "/settings/admin/projects"
  | "/settings/api"
  | "/settings/password"
  | "/settings/security"
  | "/settings/two-factor";

interface AdminSection {
  href: AdminPath;
  label: string;
}

/**
 * The sections, grouped the way an owner meets them: what they write, then the account behind it.
 *
 * The group labels are part of the navigation's meaning, so they are rendered next to the links
 * rather than folded into each label ("内容 · 文章" reads worse in a list).
 */
const GROUPS: readonly { items: readonly AdminSection[]; label: string }[] = [
  {
    items: [
      { href: "/settings/admin", label: "总览" },
      { href: "/settings/admin/posts", label: "文章" },
      { href: "/settings/admin/micro", label: "微言" },
      { href: "/settings/admin/projects", label: "项目" },
      { href: "/settings/admin/changelog", label: "更新日志" },
    ],
    label: "内容",
  },
  {
    items: [
      { href: "/settings/admin/profile", label: "站点" },
      { href: "/settings/security", label: "安全" },
      // Next to 安全 because both are account protection.
      { href: "/settings/two-factor", label: "两步验证" },
      { href: "/settings/password", label: "密码" },
    ],
    label: "账号",
  },
  {
    items: [{ href: "/settings/api", label: "API 令牌" }],
    label: "集成",
  },
] as const;

/** Every settings path, flattened once for the pathname-aware layout. */
const ADMIN_PATHS: readonly AdminPath[] = GROUPS.flatMap((group) =>
  group.items.map((item) => item.href)
);

const linkClass = (active: boolean) =>
  active
    ? "bg-accent text-accent-foreground block rounded-md px-2.5 py-1.5 font-medium"
    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground block rounded-md px-2.5 py-1.5 transition-colors";

/**
 * The settings sections, as a vertical list.
 *
 * It is one component so the desktop column and the narrow-screen drawer cannot drift apart; the
 * landmark label and `aria-current` are the same in both.
 */
const AdminNavList = ({
  current,
  onNavigate,
}: {
  current: AdminPath;
  onNavigate?: () => void;
}) => (
  <nav
    aria-label="设置"
    className="flex flex-col gap-5 text-sm"
    data-slot="admin-nav"
  >
    {GROUPS.map((group) => (
      <div className="flex flex-col gap-1.5" key={group.label}>
        <p className="text-muted-foreground px-2.5 text-xs font-semibold tracking-wide uppercase">
          {group.label}
        </p>
        <ul className="flex flex-col gap-0.5">
          {group.items.map((section) => (
            <li key={section.href}>
              <Link
                aria-current={section.href === current ? "page" : undefined}
                className={linkClass(section.href === current)}
                href={section.href}
                onClick={onNavigate}
                prefetch={section.href === "/settings/api" ? false : undefined}
              >
                {section.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

/** The desktop sidebar column. The shell keeps it sticky; the list itself owns no positioning. */
const AdminNav = ({ current }: { current: AdminPath }) => (
  <AdminNavList current={current} />
);

const MobileDrawer = ({ current }: { current: AdminPath }) => {
  const { close, detailsRef, onToggle, open } = useDisclosure();

  return (
    <details
      className="relative"
      onToggle={onToggle}
      open={open}
      ref={detailsRef}
    >
      <summary className="border-border bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex cursor-pointer list-none items-center gap-2 rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden="true" className="size-4" />
        设置
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div className="bg-popover absolute top-full left-0 z-30 mt-2 max-h-[70vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border p-3 shadow-lg">
        <AdminNavList current={current} onNavigate={close} />
      </div>
    </details>
  );
};

/**
 * The narrow-screen drawer.
 *
 * It reuses `useDisclosure`, so outside pointerdown, Escape (returning focus to the summary), a link
 * activation and a route change all close it the same way the header menus do; keying it on the path
 * is what makes a route change start closed.
 */
const AdminMobileNav = ({ current }: { current: AdminPath }) => {
  const pathname = usePathname();

  return <MobileDrawer current={current} key={pathname} />;
};

/** The sidebar resolves the active path itself so the server layout can render it once. */
export const SettingsSidebar = () => {
  const pathname = usePathname();

  const current =
    ADMIN_PATHS.toSorted((left, right) => right.length - left.length).find(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    ) ?? "/settings/admin";

  return (
    <>
      <div className="lg:hidden">
        <AdminMobileNav current={current} />
      </div>
      <div className="hidden lg:block">
        <AdminNav current={current} />
      </div>
    </>
  );
};
