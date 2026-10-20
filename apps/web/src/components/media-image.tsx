import Image from "next/image";

import { assetUrl } from "#src/components/asset-url.ts";

/**
 * A media thumbnail, resolved from a stored key or an absolute URL.
 *
 * `unoptimized` is deliberate: the objects sit behind a CDN host this app does not list under
 * `images.remotePatterns`, and Next's optimizer refuses a remote host it was not told about. The
 * CDN already serves the object at its uploaded size, so the browser fetches it as-is; `fill`
 * keeps the frame from collapsing while it loads. When a row carries dimensions the image keeps
 * its own aspect ratio instead of being cropped to the frame.
 */
interface MediaImageProps {
  alt: string;
  /** Stored object key, used when `src` is absent. */
  assetKey?: string | null;
  className?: string;
  /** Stretch to a `relative` parent's box. */
  fill?: boolean;
  height?: number | null;
  /** Responsive width hint for the `fill` branch; pass the real rendered width from the caller. */
  sizes?: string;
  src?: string | null;
  width?: number | null;
}

export const MediaImage = ({
  alt,
  assetKey,
  className,
  fill = false,
  height,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  src,
  width,
}: MediaImageProps) => {
  const url = assetUrl(src) ?? assetUrl(assetKey);

  if (url === null) {
    return null;
  }

  if (
    !fill &&
    width !== null &&
    width !== undefined &&
    width > 0 &&
    height !== null &&
    height !== undefined &&
    height > 0
  ) {
    return (
      <Image
        alt={alt}
        className={className}
        height={height}
        src={url}
        unoptimized
        width={width}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      fill
      sizes={sizes}
      src={url}
      unoptimized
    />
  );
};
