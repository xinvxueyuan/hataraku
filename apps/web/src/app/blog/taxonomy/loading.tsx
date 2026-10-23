const CATEGORY_CARDS = [0, 1, 2, 3] as const;
const TAGS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Taxonomy index skeleton: two category cards per row on a wide screen, a wrapped run of tag pills
 * below — the same two shapes the page renders.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12"
    data-slot="taxonomy-loading"
  >
    <span className="sr-only">正在加载分类与标签</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-40 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-56 max-w-full animate-pulse rounded-md" />
    </div>

    <section className="flex flex-col gap-4">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORY_CARDS.map((card) => (
          <div className="flex flex-col gap-2 rounded-lg border p-4" key={card}>
            <div className="flex items-center justify-between gap-3">
              <div className="bg-muted h-5 w-24 animate-pulse rounded-md" />
              <div className="bg-muted/60 h-3 w-10 animate-pulse rounded-md" />
            </div>
            <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </section>

    <section className="flex flex-col gap-4">
      <div className="bg-muted h-6 w-16 animate-pulse rounded-md" />
      <div className="bg-muted/60 h-4 w-48 max-w-full animate-pulse rounded-md" />
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <div
            className="bg-muted/60 h-7 w-20 animate-pulse rounded-full border"
            key={tag}
          />
        ))}
      </div>
    </section>

    <div className="border-t pt-4">
      <div className="bg-muted h-4 w-56 max-w-full animate-pulse rounded-md" />
    </div>
  </div>
);

export default Loading;
