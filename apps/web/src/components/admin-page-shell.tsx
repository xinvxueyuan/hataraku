import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminPath } from "#src/components/admin-nav.tsx";
import { AdminMobileNav, AdminNav } from "#src/components/admin-nav.tsx";

/**
 * The frame every settings page shares: a section column on the left, the page's title and action,
 * and its content.
 *
 * The column is sticky on desktop and becomes a disclosure on narrow screens. The shell is wider
 * than the reading column (`main` caps at `max-w-2xl`), so it steps out of that width symmetrically
 * with `left-1/2 -translate-x-1/2` and a width bounded by the viewport; the content column itself
 * keeps the same `max-w-2xl` measure it had before the sidebar existed.
 */
export const AdminPageShell = ({
  action,
  children,
  current,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  current: AdminPath;
  description: string;
  title: string;
}) => (
  <section
    className="relative left-1/2 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2"
    data-slot="admin-shell"
  >
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside
        className="lg:sticky lg:top-20 lg:self-start"
        data-slot="admin-sidebar"
      >
        <div className="lg:hidden">
          <AdminMobileNav current={current} />
        </div>
        <div className="hidden lg:block">
          <AdminNav current={current} />
        </div>
      </aside>

      <div className="grid min-w-0 gap-6" data-slot="admin-content">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  </section>
);

/** The way back from an editor to its index. */
export const AdminBackLink = ({ href }: { href: AdminPath }) => (
  <nav className="text-sm">
    <Link className="text-muted-foreground hover:underline" href={href}>
      ← 返回列表
    </Link>
  </nav>
);
