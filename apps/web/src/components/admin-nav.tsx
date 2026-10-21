import Link from "next/link";

/** The four writing surfaces. Naming them as literals is what keeps `<Link href>` type-checked. */
export type AdminPath =
  | "/settings/admin"
  | "/settings/admin/changelog"
  | "/settings/admin/micro"
  | "/settings/admin/posts"
  | "/settings/admin/profile"
  | "/settings/admin/projects"
  | "/settings/password"
  | "/settings/security"
  | "/settings/two-factor";

const SECTIONS: readonly { href: AdminPath; label: string }[] = [
  { href: "/settings/admin", label: "总览" },
  { href: "/settings/admin/posts", label: "文章" },
  { href: "/settings/admin/micro", label: "微言" },
  { href: "/settings/admin/projects", label: "项目" },
  { href: "/settings/admin/changelog", label: "更新日志" },
  { href: "/settings/admin/profile", label: "站点" },
  { href: "/settings/security", label: "安全" },
  // Next to 安全 because both are account protection; the order matches how a reader meets them.
  { href: "/settings/two-factor", label: "两步验证" },
  { href: "/settings/password", label: "密码" },
] as const;

/**
 * The admin sections, as one row of links.
 *
 * It sits above every admin page so the surfaces are reachable from each other; the page a reader is
 * on is marked with `aria-current`.
 */
export const AdminNav = ({ current }: { current: AdminPath }) => (
  <nav
    aria-label="设置"
    className="text-muted-foreground flex flex-wrap gap-1 text-sm"
    data-slot="admin-nav"
  >
    {SECTIONS.map((section) => (
      <Link
        aria-current={section.href === current ? "page" : undefined}
        className={
          section.href === current
            ? "bg-accent text-accent-foreground rounded-md px-2.5 py-1 font-medium"
            : "hover:bg-accent/60 rounded-md px-2.5 py-1 transition-colors"
        }
        href={section.href}
        key={section.href}
      >
        {section.label}
      </Link>
    ))}
  </nav>
);
