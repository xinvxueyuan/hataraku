const PROJECT_CARDS = [0, 1, 2, 3] as const;

/**
 * Project shelf skeleton.
 *
 * The cards are a 16:9 cover, a title row with two badges, a description, and a link row — the exact
 * four bands the shelf card renders in two columns.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="projects-loading"
  >
    <span className="sr-only">正在加载项目</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-48 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {PROJECT_CARDS.map((card) => (
        <div
          className="flex h-full flex-col overflow-hidden rounded-xl border"
          key={card}
        >
          <div className="bg-muted aspect-video w-full animate-pulse border-b" />
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="bg-muted h-5 w-2/3 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-5 w-14 shrink-0 animate-pulse rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
              <div className="bg-muted/60 h-4 w-3/5 animate-pulse rounded-md" />
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <div className="bg-muted/60 h-5 w-12 animate-pulse rounded-full" />
              <div className="bg-muted/60 h-4 w-16 animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
