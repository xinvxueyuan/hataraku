import { MediaImage } from "#src/components/media-image.tsx";

/**
 * An article's cover, when the article actually has one.
 *
 * A missing cover renders nothing and the text takes the full column. A grey frame holding the
 * title's first letter reads as a broken image ("一" and a dash are indistinguishable at that size),
 * and a placeholder only its author understands is worse than no frame at all.
 */
interface PostCoverProps {
  /** Frame size and margins; the aspect ratio stays fixed unless `aspectClassName` overrides it. */
  className?: string;
  aspectClassName?: string;
  coverKey: string | null;
  /** Rendered width hint for the browser's image selection. */
  sizes: string;
  title: string;
}

const hasCover = (coverKey: string | null): boolean =>
  coverKey !== null && coverKey.trim() !== "";

export const PostCover = ({
  aspectClassName = "aspect-video",
  className = "",
  coverKey,
  sizes,
  title,
}: PostCoverProps) => {
  if (!hasCover(coverKey)) {
    return null;
  }

  return (
    <div
      className={`bg-muted relative overflow-hidden rounded-lg border ${aspectClassName} ${className}`}
      data-slot="post-cover"
    >
      <MediaImage
        alt={title}
        assetKey={coverKey}
        className="object-cover"
        fill
        sizes={sizes}
      />
    </div>
  );
};
