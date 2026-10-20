import { MediaImage } from "#src/components/media-image.tsx";

/**
 * An article's cover, with a stable frame whether or not a cover exists.
 *
 * Every card keeps the same aspect ratio, so a page mixes covered and uncovered articles without
 * the grid reflowing when the first image loads or when a row has no image at all. The letter behind
 * the image is the fallback: an article without a cover shows its initial on a muted gradient rather
 * than an empty hole or a broken-image icon.
 */
interface PostCoverProps {
  /** Frame size and margins; the aspect ratio stays fixed unless `aspectClassName` overrides it. */
  className?: string;
  aspectClassName?: string;
  coverKey: string | null;
  coverSrc?: string | null;
  /** Rendered width hint for the browser's image selection. */
  sizes: string;
  title: string;
}

/** First letter or digit in the title, skipping leading punctuation; a muted "夜" when it has none. */
const initialOf = (title: string): string => {
  const first = /[\p{L}\p{N}]/u.exec(title);

  return (first?.[0] ?? "夜").toUpperCase();
};

export const PostCover = ({
  aspectClassName = "aspect-video",
  className = "",
  coverKey,
  coverSrc = null,
  sizes,
  title,
}: PostCoverProps) => (
  <div
    className={`bg-muted relative overflow-hidden rounded-lg border ${aspectClassName} ${className}`}
    data-slot="post-cover"
  >
    <span
      aria-hidden="true"
      className="text-muted-foreground from-muted to-muted/40 absolute inset-0 flex items-center justify-center bg-linear-to-br text-2xl font-semibold select-none"
    >
      {initialOf(title)}
    </span>
    <MediaImage
      alt={title}
      assetKey={coverKey}
      className="object-cover"
      fill
      sizes={sizes}
      src={coverSrc}
    />
  </div>
);
