const STATS = [0, 1, 2, 3] as const;
const TIMELINE = [0, 1, 2] as const;
const PLACES = [0, 1, 2, 3, 4, 5] as const;

/**
 * About skeleton.
 *
 * Four bands, in the order the page reads them: the profile card (avatar plus identity lines), the
 * four-up stat grid, the timeline ruled by its left border, and the two-column places shelf.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12"
    data-slot="about-loading"
  >
    <span className="sr-only">正在加载站点介绍</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-56 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="bg-muted size-16 shrink-0 animate-pulse rounded-2xl" />
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-7 w-40 animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-56 max-w-full animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-2/3 animate-pulse rounded-md" />
        </div>
      </div>
    </div>

    <section className="flex flex-col gap-4">
      <div className="bg-muted h-6 w-24 animate-pulse rounded-md" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div
            className="flex h-full items-center justify-between gap-3 rounded-lg border p-3"
            key={stat}
          >
            <div className="bg-muted/60 h-4 w-12 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-5 w-8 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4">
      <div className="bg-muted h-6 w-24 animate-pulse rounded-md" />
      <div className="flex flex-col gap-5 border-l pl-6">
        {TIMELINE.map((entry) => (
          <div className="flex flex-col gap-2" key={entry}>
            <div className="flex flex-wrap items-baseline gap-3">
              <div className="bg-muted/60 h-3 w-20 animate-pulse rounded-md" />
              <div className="bg-muted h-5 w-1/3 animate-pulse rounded-md" />
            </div>
            <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        {PLACES.map((place) => (
          <div
            className="flex h-full flex-col gap-2 rounded-lg border p-4"
            key={place}
          >
            <div className="bg-muted h-5 w-1/3 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-4 w-4/5 animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default Loading;
