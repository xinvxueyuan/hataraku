import { Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Pager } from "@hataraku/components/pager";
import { Badge } from "@hataraku/ui/components/badge";

import { MediaImage } from "#src/components/media-image.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * Albums, newest first.
 *
 * A cover is a bare object key; `MediaImage` resolves it through the configured media host.
 */

export const metadata: Metadata = {
  description: "生活碎片与视觉练习的影像集。",
  title: "相册",
};

const PAGE_SIZE = 12;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

type Album = Awaited<
  ReturnType<typeof serverCall.media.albums.list>
>["items"][number];

const formatDate = (album: Album): string | null => {
  if (album.date !== null) {
    const parsed = new Date(`${album.date}T00:00:00Z`);

    return Number.isNaN(parsed.getTime())
      ? album.date
      : dateFormatter.format(parsed);
  }

  return album.publishedAt === null
    ? null
    : dateFormatter.format(album.publishedAt);
};

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const focusRing =
  "rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const AlbumCard = ({ album }: { album: Album }) => {
  const date = formatDate(album);
  const dateTime = album.date ?? album.publishedAt?.toISOString();
  const coverSource = album.coverKey;

  return (
    <Link
      className={`${focusRing} hover:bg-accent flex h-full flex-col overflow-hidden border transition-colors`}
      href={`/albums/${album.slug}`}
    >
      <span className="bg-muted relative block aspect-[16/9] overflow-hidden">
        <MediaImage
          alt={album.title}
          assetKey={album.coverKey}
          className="object-cover"
          fill
        />
        {coverSource === null || coverSource === "" ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground absolute inset-0 flex items-center justify-center"
          >
            <Images className="size-8" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-medium">{album.title}</span>
        {album.description === null ? null : (
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {album.description}
          </span>
        )}
        <span className="text-muted-foreground mt-auto flex flex-wrap items-center gap-2 text-xs">
          {date === null ? null : <time dateTime={dateTime}>{date}</time>}
          {album.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </span>
      </span>
    </Link>
  );
};

const AlbumsPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const result = await serverCall.media.albums.list({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">相册</h1>
        <p className="text-muted-foreground">
          {result.total} 本影像集，按拍摄日期从新到旧排列。
        </p>
      </header>

      {result.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          {result.total === 0 ? (
            <>
              还没有相册。整理好第一组照片后，它会出现在这里——先去{" "}
              <Link className={`${focusRing} underline`} href="/blog/archive">
                归档
              </Link>{" "}
              逛逛，或者回到{" "}
              <Link className={`${focusRing} underline`} href="/">
                首页
              </Link>
              。
            </>
          ) : (
            <>
              这一页没有相册了。{" "}
              <Link className={`${focusRing} underline`} href="/albums">
                回到第一页
              </Link>
              。
            </>
          )}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-slot="album-list">
          {result.items.map((album) => (
            <li key={album.id}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}

      <Pager
        currentPage={result.page}
        hrefFor={(target) =>
          target <= 1 ? "/albums" : `/albums?page=${target}`
        }
        label="相册分页"
        totalPages={result.totalPages}
      />
    </div>
  );
};

export default AlbumsPage;
