import Link from "next/link";
import type { ReactNode } from "react";

import type { AdminPath } from "#src/components/admin-nav.tsx";

/**
 * A settings page's header and content. The frame (sidebar + content column) lives in
 * `app/settings/layout.tsx`, so pages only describe themselves; the shared layout stays mounted
 * while the route changes.
 */
export const SettingsPageHeader = ({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="grid gap-1">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    {action}
  </div>
);

/** The way back from an editor to its index. */
export const AdminBackLink = ({ href }: { href: AdminPath }) => (
  <nav className="text-sm">
    <Link className="text-muted-foreground hover:underline" href={href}>
      ← 返回列表
    </Link>
  </nav>
);
