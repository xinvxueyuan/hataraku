/**
 * One portal module tile: what the module is, how much it holds, and its newest item.
 *
 * The tile is a plain anchor on purpose. It is a generic building block, so it depends on no router
 * and no business data shape; the application decides the href and supplies already-formatted copy.
 */
export interface ModuleTileLatest {
  /** Display date, or null when the module has no dated item. */
  date: string | null;
  href: string;
  title: string;
}

export interface ModuleTileProps {
  count: number;
  countUnit: string;
  href: string;
  label: string;
  latest: ModuleTileLatest | null;
}

export const ModuleTile = ({
  count,
  countUnit,
  href,
  label,
  latest,
}: ModuleTileProps) => (
  <a
    className="group hover:bg-accent flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border p-5 transition-colors"
    data-slot="module-tile"
    href={href}
  >
    <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
      {label}
    </span>
    <span className="flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold tabular-nums">{count}</span>
      <span className="text-muted-foreground text-xs">{countUnit}</span>
      <span
        aria-hidden="true"
        className="text-muted-foreground ml-auto text-sm"
      >
        →
      </span>
    </span>
    {latest === null ? (
      <span className="text-muted-foreground text-sm">还没有内容</span>
    ) : (
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium">{latest.title}</span>
        {latest.date === null ? null : (
          <span className="text-muted-foreground text-xs">{latest.date}</span>
        )}
      </span>
    )}
  </a>
);
