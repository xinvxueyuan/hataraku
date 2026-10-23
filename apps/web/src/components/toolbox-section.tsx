import Link from "next/link";
import type { ReactNode } from "react";

import { focusRing } from "@hataraku/components/focus-ring";

/**
 * The frame every toolbox section page shares: the way back to the hub, its own title, what it
 * holds, and what "nothing here yet" means.
 *
 * The four sections are unrelated directories, so only the frame is shared — each page renders its
 * own rows and writes the copy that explains its own empty state.
 */
export const ToolboxSection = ({
  children,
  count,
  description,
  empty,
  footer,
  hasItems,
  title,
}: {
  children: ReactNode;
  /** A short count read from the same procedure as the list, e.g. "共 2 台设备". */
  count: string;
  description: string;
  /** Rendered instead of `children` when the section holds nothing. */
  empty: ReactNode;
  /** Pagination for the sections long enough to need it. */
  footer?: ReactNode;
  hasItems: boolean;
  title: string;
}) => (
  <div
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="toolbox-section"
  >
    <header className="flex flex-col gap-3">
      <nav aria-label="工具箱" className="text-sm">
        <Link
          className={`${focusRing} text-muted-foreground hover:underline`}
          href="/toolbox"
        >
          ← 工具箱
        </Link>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {hasItems ? (
          <p className="text-muted-foreground text-sm tabular-nums">{count}</p>
        ) : null}
      </div>
    </header>

    {hasItems ? children : empty}
    {footer}
  </div>
);
