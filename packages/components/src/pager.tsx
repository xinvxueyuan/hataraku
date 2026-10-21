/**
 * Previous/next links for a paginated server-rendered list.
 *
 * The caller owns `hrefFor` so each list keeps its own route and filters; plain anchors rather
 * than a framework link, because a page turn is a server render and needs no client navigation.
 */
interface PagerProps {
  currentPage: number;
  hrefFor: (page: number) => string;
  /** Accessible name for the navigation landmark; the caller owns its language. */
  label: string;
  totalPages: number;
}

const linkClass =
  "rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/** A disabled neighbour reads as unavailable: dimmed, not a link, and announced as disabled. */
const disabledClass =
  "text-muted-foreground/60 pointer-events-none cursor-not-allowed opacity-30 select-none";

export const Pager = ({
  currentPage,
  hrefFor,
  label,
  totalPages,
}: PagerProps) => {
  // An out-of-range page has no neighbours to offer; the page's empty state explains and links back.
  if (totalPages <= 1 || currentPage > totalPages) {
    return null;
  }

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between border-t pt-4 text-sm"
    >
      {currentPage <= 1 ? (
        <span aria-disabled="true" className={disabledClass}>
          上一页
        </span>
      ) : (
        <a className={linkClass} href={hrefFor(currentPage - 1)}>
          上一页
        </a>
      )}
      <span className="text-muted-foreground">
        第 {currentPage} / {totalPages} 页
      </span>
      {currentPage >= totalPages ? (
        <span aria-disabled="true" className={disabledClass}>
          下一页
        </span>
      ) : (
        <a className={linkClass} href={hrefFor(currentPage + 1)}>
          下一页
        </a>
      )}
    </nav>
  );
};
