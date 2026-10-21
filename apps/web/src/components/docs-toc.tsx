import type { TocHeading } from "#src/lib/markdown/headings.ts";

/**
 * The page's table of contents.
 *
 * The headings are collected from the rendered body, so every href is the id the page actually
 * emitted. The scroll-highlighting variant is deliberately left out: it would need a second source
 * of truth for "current heading" (an IntersectionObserver) and the anchors work without it.
 */
export const DocsToc = ({ headings }: { headings: readonly TocHeading[] }) => {
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label="本页目录" className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        本页目录
      </p>
      <ul className="border-border flex flex-col gap-1 border-l">
        {headings.map((heading) => (
          <li
            className={heading.depth === 3 ? "pl-6" : "pl-3"}
            key={`${heading.id}-${heading.depth}`}
          >
            <a
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background -ml-px block border-l border-transparent transition-colors hover:border-current focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              href={`#${heading.id}`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
