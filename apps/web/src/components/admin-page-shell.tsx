import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminPath } from "#src/components/admin-nav.tsx";
import { AdminNav } from "#src/components/admin-nav.tsx";

/**
 * The frame every admin page shares: the section links, the page title and one optional action.
 *
 * Keeping it in one component means the four writing surfaces cannot drift apart in spacing or in
 * the way they announce themselves.
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
  <section className="grid gap-6">
    <AdminNav current={current} />
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action}
    </div>
    {children}
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
