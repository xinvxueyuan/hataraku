"use client";

import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDisclosure } from "@hataraku/components/use-disclosure";

import { docsBySection } from "#src/components/docs-nav.ts";
import type { DocLink } from "#src/components/docs-nav.ts";

/**
 * The docs navigation.
 *
 * Groups follow the frontmatter `section` (docs without one land in "入门") and entries within a
 * group follow `order`, so the sidebar is predictable without a second index file. The mobile
 * drawer reuses `useDisclosure`: outside click, Escape, route change and link selection close it
 * through the same state the header menus use.
 */
const currentSlug = (pathname: string): string | null =>
  pathname.startsWith("/docs/")
    ? decodeURIComponent(pathname.slice("/docs/".length))
    : null;

const SidebarNav = ({
  groups,
  label,
  onNavigate,
  pathname,
}: {
  groups: [string, DocLink[]][];
  label: string;
  onNavigate?: () => void;
  pathname: string;
}) => {
  const active = currentSlug(pathname);

  return (
    <nav aria-label={label} className="flex flex-col gap-6 text-sm">
      {groups.map(([section, items]) => (
        <div className="flex flex-col gap-2" key={section}>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {section}
          </p>
          <ul className="flex flex-col gap-0.5">
            {items.map((doc) => (
              <li key={doc.slug}>
                <Link
                  aria-current={active === doc.slug ? "page" : undefined}
                  className={`block rounded-md px-2 py-1.5 transition-colors ${
                    active === doc.slug
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                  href={`/docs/${doc.slug}`}
                  onClick={onNavigate}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};

const MobileDrawer = ({ docs }: { docs: readonly DocLink[] }) => {
  const pathname = usePathname();
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
        文档目录
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </summary>
      <div className="bg-popover absolute top-full left-0 z-30 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border p-3 shadow-lg">
        <SidebarNav
          groups={docsBySection(docs)}
          label="文档目录（移动）"
          onNavigate={close}
          pathname={pathname}
        />
      </div>
    </details>
  );
};

/** Mobile drawer; keyed by path so a new route starts it closed. */
export const DocsMobileNav = ({ docs }: { docs: readonly DocLink[] }) => {
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <MobileDrawer docs={docs} key={pathname} />
    </div>
  );
};

/** Desktop sidebar. */
export const DocsSidebar = ({ docs }: { docs: readonly DocLink[] }) => {
  const pathname = usePathname();

  return (
    <SidebarNav
      groups={docsBySection(docs)}
      label="文档目录"
      pathname={pathname}
    />
  );
};
