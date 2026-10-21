import { MediaImage } from "#src/components/media-image.tsx";

/**
 * An article's cover, when the article actually has one.
 *
 * The frame used to render even without an image: a grey box with the title's first letter. Readers
 * read that as a broken image ("一" and a dash are indistinguishable at that size), so a missing
 * cover now renders nothing and the text takes the full column. An empty frame with a glyph is a
 * placeholder that only the author understands.
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

const hasCover = (coverKey: string | null, coverSrc: string | null): boolean =>
  (coverKey !== null && coverKey !== "") ||
  (coverSrc !== null && coverSrc.trim() !== "");

export const PostCover = ({
  aspectClassName = "aspect-video",
  className = "",
  coverKey,
  coverSrc = null,
  sizes,
  title,
}: PostCoverProps) => {
  if (!hasCover(coverKey, coverSrc)) {
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
        src={coverSrc}
      />
    </div>
  );
};
