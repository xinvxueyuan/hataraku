/** One heading in the rendered document, with the id its anchor uses. */
export interface TocHeading {
  depth: number;
  id: string;
  text: string;
}

interface TableOfContentsProps {
  headings: readonly TocHeading[];
  /** Accessible name for the navigation landmark; the caller owns its language. */
  label?: string;
  /** Called when a heading link is activated (a drawer uses it to close itself). */
  onNavigate?: () => void;
  /** Hide the visible title when a surrounding disclosure already labels the list. */
  showTitle?: boolean;
}

/**
 * A table of contents for headings already rendered by the caller.
 *
 * The headings carry the ids the page actually emitted, so every href is a real anchor. Scroll
 * highlighting is deliberately left out: it would need a second source of truth for "current
 * heading" and the anchors work without it.
 */
export const TableOfContents = ({
  headings,
  label = "本页目录",
  onNavigate,
  showTitle = true,
}: TableOfContentsProps) => {
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-3 text-sm">
      {showTitle ? (
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {label}
        </p>
      ) : null}
      <ul className="border-border flex flex-col gap-1 border-l">
        {headings.map((heading) => (
          <li
            className={heading.depth === 3 ? "pl-6" : "pl-3"}
            key={`${heading.id}-${heading.depth}`}
          >
            <a
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background -ml-px block border-l border-transparent transition-colors hover:border-current focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              href={`#${heading.id}`}
              onClick={onNavigate}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
