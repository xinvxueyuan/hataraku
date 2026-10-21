"use client";

import { usePathname } from "next/navigation";

import { TableOfContents } from "@hataraku/components/table-of-contents";
import type { TocHeading } from "@hataraku/components/table-of-contents";
import { useDisclosure } from "@hataraku/components/use-disclosure";
import { ChevronDown } from "@hataraku/ui/icons";

/**
 * The article's table of contents.
 *
 * Desktop keeps a sticky rail; narrow screens get a disclosure that reuses the shared behaviour:
 * outside pointerdown, Escape (focus returns to the summary), a route change (keyed on the path)
 * and activating a heading all close it. The list itself is the shared component — the same one
 * the docs pages use.
 */
const TocDrawer = ({ headings }: { headings: readonly TocHeading[] }) => {
  const { close, detailsRef, onToggle, open } = useDisclosure();

  return (
    <details
      className="relative"
      onToggle={onToggle}
      open={open}
      ref={detailsRef}
    >
      <summary className="border-border bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex cursor-pointer list-none items-center gap-2 rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        本页目录
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div className="bg-popover absolute top-full left-0 z-30 mt-2 w-64 rounded-lg border p-3 shadow-lg">
        <TableOfContents
          headings={headings}
          label="本页目录（移动）"
          onNavigate={close}
          showTitle={false}
        />
      </div>
    </details>
  );
};

/** Narrow-screen entry; keyed by path so a new article starts closed. */
export const ArticleTocMobile = ({
  headings,
}: {
  headings: readonly TocHeading[];
}) => {
  const pathname = usePathname();

  return (
    <div className="xl:hidden">
      <TocDrawer headings={headings} key={pathname} />
    </div>
  );
};

/** Desktop sticky rail. */
export const ArticleToc = ({
  headings,
}: {
  headings: readonly TocHeading[];
}) => (
  <aside className="hidden w-56 shrink-0 xl:block">
    <div className="sticky top-24">
      <TableOfContents headings={headings} />
    </div>
  </aside>
);
