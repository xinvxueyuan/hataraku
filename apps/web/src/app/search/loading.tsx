const HITS = [0, 1, 2, 3] as const;

/**
 * Search skeleton.
 *
 * The field keeps the real control height (2rem) and sits beside a submit button of the same height,
 * so the input does not resize under the pointer once the form hydrates.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="search-loading"
  >
    <span className="sr-only">正在搜索</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="flex w-full items-center gap-2">
        <div className="bg-muted/60 h-8 flex-1 animate-pulse rounded-md border" />
        <div className="bg-muted/60 h-8 w-16 shrink-0 animate-pulse rounded-md border" />
      </div>
    </div>

    <div className="bg-muted/60 h-4 w-24 animate-pulse rounded-md" />

    <div className="flex flex-col gap-4">
      {HITS.map((hit) => (
        <div className="flex flex-col gap-2" key={hit}>
          <div className="bg-muted h-6 w-2/3 animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-4/5 animate-pulse rounded-md" />
          <div className="flex flex-wrap gap-3">
            <div className="bg-muted/60 h-3 w-16 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-3 w-20 animate-pulse rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
