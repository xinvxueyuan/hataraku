const NOTE_CARDS = [0, 1, 2, 3] as const;

/**
 * Micro-feed skeleton.
 *
 * Each card is the bordered block the feed renders: a date-and-type header row, a short body, and a
 * tag run. The cards keep the 1rem gap and the 1rem padding of the real entry.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="notes-loading"
  >
    <span className="sr-only">正在加载微言</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-56 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="flex flex-col gap-4">
      {NOTE_CARDS.map((card) => (
        <div className="flex flex-col gap-3 rounded-xl border p-4" key={card}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted/60 h-3 w-24 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-5 w-12 animate-pulse rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-4 w-full animate-pulse rounded-md" />
            <div className="bg-muted/60 h-4 w-4/5 animate-pulse rounded-md" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-muted/60 h-3 w-14 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-3 w-16 animate-pulse rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
