import { ORPCError } from "@orpc/client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge } from "@hataraku/ui/components/badge";

import { assetUrl } from "#src/components/asset-url.ts";
import { contentPath } from "#src/components/content-path.ts";
import { MediaImage } from "#src/components/media-image.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * One album and its photos.
 *
 * Photos store object keys, not URLs, so the full-size link is resolved here while the thumbnail
 * still goes through `MediaImage` — one resolver, used for both the `href` and the `src`.
 */

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

const formatDate = (date: Date): string => dateFormatter.format(date);

const loadAlbum = cache(async (segment: string) => {
  try {
    return await serverCall.media.albums.byRef({ segment });
  } catch (error) {
    if (error instanceof ORPCError && error.code === "NOT_FOUND") {
      notFound();
    }

    throw error;
  }
});

interface PageProps {
  params: Promise<{ segment: string }>;
}

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { segment } = await params;
  const album = await loadAlbum(segment);

  return {
    alternates: { canonical: contentPath("/albums", album) },
    description: album.description ?? undefined,
    title: album.title,
  };
};

interface GalleryPhoto {
  alt: string;
  full: string;
  height: number | null;
  id: string;
  takenAt: Date | null;
  thumb: string;
  title: string | null;
  width: number | null;
}

const focusRing =
  "rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const AlbumPage = async ({ params }: PageProps) => {
  const { segment } = await params;
  const album = await loadAlbum(segment);

  const photos = album.photos.flatMap((photo): GalleryPhoto[] => {
    const full = assetUrl(photo.imageKey);

    if (full === null) {
      return [];
    }

    return [
      {
        alt: photo.title ?? photo.description ?? `${album.title} 的照片`,
        full,
        height: photo.height,
        id: photo.id,
        takenAt: photo.takenAt,
        thumb: assetUrl(photo.thumbKey) ?? full,
        title: photo.title,
        width: photo.width,
      },
    ];
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          className={`${focusRing} text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline`}
          href="/albums"
        >
          ← 全部相册
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{album.title}</h1>
        {album.description === null ? null : (
          <p className="text-muted-foreground">{album.description}</p>
        )}
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {album.date === null ? null : <span>{album.date}</span>}
          <span>{album.photoCount} 张照片</span>
          {album.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </p>
      </header>

      {photos.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          这本相册还没有照片。照片整理好之后会在这里展开——先回{" "}
          <Link className={`${focusRing} underline`} href="/albums">
            相册列表
          </Link>
          ，或者去{" "}
          <Link className={`${focusRing} underline`} href="/blog/archive">
            归档
          </Link>{" "}
          逛逛。
        </p>
      ) : (
        <ul className="columns-1 gap-6 sm:columns-2" data-slot="album-photos">
          {photos.map((photo) => (
            <li className="mb-6 break-inside-avoid" key={photo.id}>
              <figure className="flex flex-col gap-2">
                <a
                  className={`${focusRing} group bg-muted relative block overflow-hidden border`}
                  href={photo.full}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <MediaImage
                    alt={photo.alt}
                    className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.01]"
                    height={photo.height}
                    src={photo.thumb}
                    width={photo.width}
                  />
                </a>
                {photo.title === null && photo.takenAt === null ? null : (
                  <figcaption className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-sm">
                    {photo.title === null ? null : <span>{photo.title}</span>}
                    {photo.takenAt === null ? null : (
                      <time
                        className="text-xs"
                        dateTime={photo.takenAt.toISOString()}
                      >
                        {formatDate(photo.takenAt)}
                      </time>
                    )}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlbumPage;
