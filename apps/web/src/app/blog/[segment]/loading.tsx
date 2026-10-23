/** Body lines, paired with a key so the pulse blocks never share a React key. */
const BODY = [
  { key: "body-1", width: "w-full" },
  { key: "body-2", width: "w-11/12" },
  { key: "body-3", width: "w-full" },
  { key: "body-4", width: "w-4/5" },
  { key: "body-5", width: "w-full" },
  { key: "body-6", width: "w-3/5" },
] as const;

const TOC = [
  { key: "toc-1", width: "w-full" },
  { key: "toc-2", width: "w-4/5" },
  { key: "toc-3", width: "w-3/5" },
  { key: "toc-4", width: "w-4/5" },
] as const;

/**
 * Article skeleton: the 2:1 cover, the title block, a few body lines, and the two table-of-contents
 * placements the page uses (a drawer below xl, a sticky column above it).
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12 xl:flex-row xl:items-start xl:gap-10"
    data-slot="post-loading"
  >
    <span className="sr-only">正在加载文章</span>

    <div className="xl:hidden">
      <div className="bg-muted h-12 w-full animate-pulse rounded-lg border" />
    </div>

    <div className="flex min-w-0 flex-1 flex-col gap-8 xl:max-w-3xl">
      <div className="bg-muted aspect-[2/1] w-full animate-pulse rounded-lg border" />

      <div className="flex flex-col gap-3">
        <div className="bg-muted h-9 w-4/5 animate-pulse rounded-md" />
        <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
      </div>

      <div className="flex flex-col gap-3">
        {BODY.map((line) => (
          <div
            className={`bg-muted/60 h-4 animate-pulse rounded-md ${line.width}`}
            key={line.key}
          />
        ))}
        <div className="bg-muted mt-3 h-6 w-1/3 animate-pulse rounded-md" />
        <div className="bg-muted/60 h-4 w-full animate-pulse rounded-md" />
        <div className="bg-muted/60 h-4 w-2/3 animate-pulse rounded-md" />
      </div>
    </div>

    <aside className="hidden w-48 shrink-0 xl:block">
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-3 w-16 animate-pulse rounded-md" />
        {TOC.map((line) => (
          <div
            className={`bg-muted/60 h-3 animate-pulse rounded-md ${line.width}`}
            key={line.key}
          />
        ))}
      </div>
    </aside>
  </div>
);

export default Loading;
