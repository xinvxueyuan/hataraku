const GRID_CARDS = [0, 1, 2, 3] as const;
const SKILL_LINES = [0, 1, 2] as const;

/**
 * Toolbox skeleton.
 *
 * The page is four stacked sections (tools, devices, skills, friends) with a 2.5rem gap between
 * them. Each section keeps its own card shape: a plain tool card, a device card with a 16:9 photo,
 * a two-column skill box, and a friend card led by an avatar.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12"
    data-slot="toolbox-loading"
  >
    <span className="sr-only">正在加载工具箱</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-28 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-72 max-w-full animate-pulse rounded-md" />
    </div>

    <section className="flex flex-col gap-4" data-slot="toolbox-tools">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {GRID_CARDS.map((card) => (
          <div
            className="flex h-full flex-col gap-2 rounded-xl border p-4"
            key={card}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="bg-muted h-5 w-1/2 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-5 w-14 animate-pulse rounded-full" />
            </div>
            <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
            <div className="bg-muted/60 h-4 w-2/3 animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4" data-slot="toolbox-devices">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            className="flex h-full flex-col overflow-hidden rounded-xl border"
            key={card}
          >
            <div className="bg-muted aspect-video w-full animate-pulse border-b" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="bg-muted h-5 w-2/5 animate-pulse rounded-md" />
                <div className="bg-muted/60 h-5 w-16 animate-pulse rounded-full" />
              </div>
              <div className="bg-muted/60 h-3 w-24 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4" data-slot="toolbox-skills">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div className="flex flex-col gap-3 rounded-xl border p-4" key={card}>
            <div className="bg-muted h-4 w-16 animate-pulse rounded-md" />
            <div className="flex flex-col gap-2">
              {SKILL_LINES.map((line) => (
                <div
                  className="flex items-center justify-between gap-2"
                  key={line}
                >
                  <div className="bg-muted/60 h-3 w-1/2 animate-pulse rounded-md" />
                  <div className="bg-muted/60 h-3 w-10 animate-pulse rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4" data-slot="toolbox-friends">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            className="flex h-full flex-col gap-2 rounded-xl border p-4"
            key={card}
          >
            <div className="flex items-center gap-3">
              <div className="bg-muted size-10 shrink-0 animate-pulse rounded-full" />
              <div className="bg-muted h-5 w-24 animate-pulse rounded-md" />
            </div>
            <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
            <div className="bg-muted/60 h-4 w-16 animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default Loading;
