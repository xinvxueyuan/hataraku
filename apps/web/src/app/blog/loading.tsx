const ROWS = [0, 1, 2, 3, 4] as const;

/**
 * Article list skeleton.
 *
 * The rows carry the same gap, the same 16:9 cover and the same one/two-line title split the list
 * renders, so the finished page does not move when the stream resolves. The lead row keeps its
 * larger cover and title, which is the one place the list deliberately varies.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="blog-loading"
  >
    <span className="sr-only">正在加载文章列表</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-24 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-32 animate-pulse rounded-md" />
    </div>

    <ul className="flex flex-col gap-4">
      {ROWS.map((row) => {
        const isLead = row === 0;

        return (
          <li className="flex gap-4" key={row}>
            <div
              className={`bg-muted hidden aspect-video shrink-0 animate-pulse rounded-lg border sm:block ${isLead ? "sm:w-56" : "sm:w-40"}`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
              <div
                className={`bg-muted animate-pulse rounded-md ${isLead ? "h-8 w-4/5" : "h-6 w-3/5"}`}
              />
              <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
              <div
                className={`bg-muted/60 h-3 animate-pulse rounded-md ${isLead ? "w-2/3" : "w-2/5"}`}
              />
            </div>
          </li>
        );
      })}
    </ul>

    <div className="flex items-center justify-between border-t pt-4">
      <div className="bg-muted h-4 w-16 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-16 animate-pulse rounded-md" />
    </div>
  </div>
);

export default Loading;
