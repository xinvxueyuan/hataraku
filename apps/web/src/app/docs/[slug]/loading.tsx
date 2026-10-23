const BODY = [
  { key: "doc-1", width: "w-full" },
  { key: "doc-2", width: "w-11/12" },
  { key: "doc-3", width: "w-full" },
  { key: "doc-4", width: "w-4/5" },
  { key: "doc-5", width: "w-full" },
] as const;

const TOC = [
  { key: "doc-toc-1", width: "w-full" },
  { key: "doc-toc-2", width: "w-4/5" },
  { key: "doc-toc-3", width: "w-3/5" },
] as const;

/**
 * Doc skeleton: breadcrumb, title, body lines, the previous/next pair, and the table of contents the
 * page pins beside the prose from xl up.
 */
const Loading = () => (
  <div aria-busy="true" className="flex gap-10" data-slot="doc-loading">
    <span className="sr-only">正在加载文档</span>

    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <div className="bg-muted h-4 w-48 max-w-full animate-pulse rounded-md" />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-9 w-2/3 animate-pulse rounded-md" />
          <div className="bg-muted/60 h-4 w-1/2 animate-pulse rounded-md" />
        </div>
        <div className="flex flex-col gap-3">
          {BODY.map((line) => (
            <div
              className={`bg-muted/60 h-4 animate-pulse rounded-md ${line.width}`}
              key={line.key}
            />
          ))}
          <div className="bg-muted mt-2 h-6 w-1/4 animate-pulse rounded-md" />
          {BODY.map((line) => (
            <div
              className={`bg-muted/60 h-4 animate-pulse rounded-md ${line.width}`}
              key={`repeat-${line.key}`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="bg-muted/60 h-3 w-16 animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded-md" />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:col-start-2">
          <div className="bg-muted/60 ml-auto h-3 w-16 animate-pulse rounded-md" />
          <div className="bg-muted ml-auto h-4 w-2/3 animate-pulse rounded-md" />
        </div>
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
