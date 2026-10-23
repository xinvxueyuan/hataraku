const ENTRIES = [0, 1, 2] as const;
const CHANGES = [0, 1, 2] as const;

/**
 * Changelog skeleton: a version header (version, badge, date), an optional title, and the bullet list
 * each release carries. Entries keep the 1rem gap and the 1.25rem padding of the real card.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="changelog-loading"
  >
    <span className="sr-only">正在加载更新日志</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-32 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-64 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="flex flex-col gap-4">
      {ENTRIES.map((entry) => (
        <div className="flex flex-col gap-3 rounded-xl border p-5" key={entry}>
          <div className="flex flex-wrap items-baseline gap-3">
            <div className="bg-muted h-6 w-20 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-5 w-16 animate-pulse rounded-full" />
            <div className="bg-muted/60 h-3 w-20 animate-pulse rounded-md" />
          </div>
          <div className="bg-muted/60 h-4 w-1/2 animate-pulse rounded-md" />
          <div className="flex flex-col gap-2">
            {CHANGES.map((change) => (
              <div
                className="bg-muted/60 h-3 w-4/5 animate-pulse rounded-md"
                key={change}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
