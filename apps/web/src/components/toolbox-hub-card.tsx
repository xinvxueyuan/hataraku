import type { Route } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { ChevronRight } from "@hataraku/ui/icons";

/**
 * One toolbox hub card: which module this is, what it holds, and how many rows it has.
 *
 * A module with nothing in it says so on the card instead of borrowing another module's activity,
 * and the card stays a link: the section page is where its honest empty state lives.
 */
export const ToolboxHubCard = ({
  count,
  countUnit,
  description,
  href,
  label,
}: {
  count: number;
  /** The noun the count counts, e.g. "个工具". */
  countUnit: string;
  description: string;
  href: Route;
  label: string;
}) => (
  <Link
    className={`${focusRing} hover:bg-accent flex h-full min-w-0 flex-col gap-2 rounded-xl border p-5 transition-colors`}
    data-slot="toolbox-hub-card"
    href={href}
  >
    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {`${count} ${countUnit}`}
      </span>
    </span>
    <span className="text-muted-foreground text-sm">{description}</span>
    <span className="mt-auto flex items-center gap-1 pt-2 text-sm">
      {count === 0 ? (
        <span className="text-muted-foreground">还没有内容</span>
      ) : (
        <span className="font-medium">查看全部</span>
      )}
      <ChevronRight
        aria-hidden="true"
        className="text-muted-foreground size-3.5"
      />
    </span>
  </Link>
);
