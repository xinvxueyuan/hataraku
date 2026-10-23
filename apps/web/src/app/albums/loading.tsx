const ALBUM_CARDS = [0, 1, 2, 3] as const;

/**
 * Album shelf skeleton. The cover is 16:9 and the card is a link with no border radius of its own —
 * the same frame the album list draws.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="albums-loading"
  >
    <span className="sr-only">正在加载相册</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-56 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {ALBUM_CARDS.map((card) => (
        <div className="flex h-full flex-col overflow-hidden border" key={card}>
          <div className="bg-muted aspect-[16/9] w-full animate-pulse" />
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="bg-muted h-5 w-1/2 animate-pulse rounded-md" />
            <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
            <div className="bg-muted/60 mt-auto h-3 w-1/3 animate-pulse rounded-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
