const YEAR_CHIPS = [0, 1, 2] as const;
const YEARS = [0, 1] as const;
const ENTRIES = [0, 1, 2, 3] as const;

/**
 * Archive skeleton.
 *
 * The page is a year → month → entry outline, so the skeleton repeats that nesting instead of
 * drawing a flat list: the year chips, the year heading, the month heading, then the dated rows.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="archive-loading"
  >
    <span className="sr-only">正在加载归档</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-64 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="flex flex-wrap gap-2">
      {YEAR_CHIPS.map((chip) => (
        <div
          className="bg-muted/60 h-7 w-20 animate-pulse rounded-full border"
          key={chip}
        />
      ))}
    </div>

    {YEARS.map((year) => (
      <section className="flex flex-col gap-4" key={year}>
        <div className="bg-muted h-7 w-28 animate-pulse rounded-md" />
        <div className="flex flex-col gap-2">
          <div className="bg-muted/60 h-3 w-14 animate-pulse rounded-md" />
          <div className="divide-border flex flex-col divide-y">
            {ENTRIES.map((entry) => (
              <div className="flex gap-3 py-3" key={entry}>
                <div className="bg-muted/60 mt-1 h-3 w-10 shrink-0 animate-pulse rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="bg-muted h-5 w-3/5 animate-pulse rounded-md" />
                  <div className="bg-muted/60 h-3 w-24 animate-pulse rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    ))}

    <div className="border-t pt-4">
      <div className="bg-muted h-4 w-48 animate-pulse rounded-md" />
    </div>
  </div>
);

export default Loading;
