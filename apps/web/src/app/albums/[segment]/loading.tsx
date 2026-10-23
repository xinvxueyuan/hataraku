const PHOTOS = [
  { caption: "w-1/2", key: "photo-1", ratio: "aspect-[4/3]" },
  { caption: "w-1/3", key: "photo-2", ratio: "aspect-[3/4]" },
  { caption: "w-2/5", key: "photo-3", ratio: "aspect-video" },
  { caption: "w-1/2", key: "photo-4", ratio: "aspect-[4/3]" },
] as const;

/**
 * Album skeleton.
 *
 * The gallery is a CSS multi-column stack, so the placeholder keeps the two-column flow and the
 * varied aspect ratios — a single uniform grid would collapse to one shape when the photos land.
 */
const Loading = () => (
  <div
    aria-busy="true"
    className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12"
    data-slot="album-loading"
  >
    <span className="sr-only">正在加载相册照片</span>

    <div className="flex flex-col gap-2">
      <div className="bg-muted/60 h-4 w-24 animate-pulse rounded-md" />
      <div className="bg-muted h-9 w-48 max-w-full animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-2/3 animate-pulse rounded-md" />
      <div className="bg-muted/60 h-4 w-40 animate-pulse rounded-md" />
    </div>

    <div className="columns-1 gap-6 sm:columns-2">
      {PHOTOS.map((photo) => (
        <div className="mb-6 break-inside-avoid" key={photo.key}>
          <div
            className={`bg-muted w-full animate-pulse border ${photo.ratio}`}
          />
          <div
            className={`bg-muted/60 mt-2 h-3 animate-pulse rounded-md ${photo.caption}`}
          />
        </div>
      ))}
    </div>
  </div>
);

export default Loading;
