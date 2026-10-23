const GROUPS = [0, 1, 2] as const;
const DOC_CARDS = [0, 1, 2] as const;

/**
 * Docs index skeleton.
 *
 * The page renders inside the docs layout, which already supplies the sidebar, so this file only
 * draws the column it owns: a heading and the section → card list, in the same order the markdown
 * files are read.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="flex flex-col gap-8"
    data-slot="docs-loading"
  >
    <span className="sr-only">正在加载文档</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted h-9 w-20 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-64 max-w-full animate-pulse rounded-md" />
    </div>

    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => (
        <section className="flex flex-col gap-3" key={group}>
          <div className="bg-muted/60 h-3 w-16 animate-pulse rounded-md" />
          <div className="flex flex-col gap-3">
            {DOC_CARDS.map((card) => (
              <div
                className="flex flex-col gap-2 rounded-lg border p-4"
                key={card}
              >
                <div className="bg-muted h-5 w-1/3 animate-pulse rounded-md" />
                <div className="bg-muted/60 h-4 w-3/5 animate-pulse rounded-md" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  </div>
);

export default Loading;
