import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Pager } from "@hataraku/components/pager";
import { Badge } from "@hataraku/ui/components/badge";

import { formatDisplayDate } from "#src/components/display-date.ts";
import { MediaImage } from "#src/components/media-image.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The micro feed: short notes, code fragments, dialogues and music, newest first.
 *
 * The body is plain text from the database, so it renders in a `whitespace-pre-line` block rather
 * than through the MDX pipeline — a fragment keeps the line breaks its author typed.
 */

export const metadata: Metadata = {
  description: "短句、代码片段、对话与音乐组成的碎片流。",
  title: "微言",
};

const PAGE_SIZE = 10;

const TYPE_LABELS = new Map([
  ["code", "代码"],
  ["dialogue", "对话"],
  ["image", "图片"],
  ["music", "音乐"],
  ["note", "随记"],
]);

const typeLabel = (type: string): string => TYPE_LABELS.get(type) ?? type;

type MicroPost = Awaited<
  ReturnType<typeof serverCall.content.micro.list>
>["items"][number];

const readPage = (raw: string | undefined): number => {
  const parsed = Number(raw ?? "1");

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

const hrefFor = (page: number): string =>
  page <= 1 ? "/notes" : `/notes?page=${page}`;

interface MicroImage {
  key: string | null;
  src: string | null;
}

const imagesOf = (entry: MicroPost): MicroImage[] => [
  ...entry.imageKeys.map((key) => ({ key, src: null })),
  ...entry.images
    .filter((src) => src.trim() !== "")
    .map((src) => ({ key: null, src })),
];

const MicroEntry = ({ entry }: { entry: MicroPost }) => {
  const published = formatDisplayDate(entry.publishedAt);
  const images = imagesOf(entry);
  const { music } = entry;

  const musicTitle =
    music === null || music === undefined
      ? ""
      : [music.track, music.artist]
          .filter((part): part is string => Boolean(part))
          .join(" — ");

  return (
    <article className="flex flex-col gap-3 rounded-xl border p-4">
      <header className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {entry.publishedAt === null ? (
          <span>未标注时间</span>
        ) : (
          <time dateTime={entry.publishedAt.toISOString()}>{published}</time>
        )}
        <Badge variant="secondary">{typeLabel(entry.type)}</Badge>
        {musicTitle === "" ? null : (
          <span className="text-muted-foreground">♪ {musicTitle}</span>
        )}
      </header>

      <p className="text-sm leading-relaxed whitespace-pre-line">
        {entry.content}
      </p>

      {music?.url === undefined ? null : (
        <p className="text-xs">
          <a
            className={`${focusRing} underline underline-offset-4`}
            href={music.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            收听这首
          </a>
        </p>
      )}

      {images.length === 0 ? null : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image, index) => (
            <li
              className="bg-muted relative aspect-4/3 overflow-hidden rounded-md border"
              key={image.key ?? image.src ?? String(index)}
            >
              <MediaImage
                alt={`${entry.slug} 的配图 ${index + 1}`}
                assetKey={image.key}
                className="object-cover"
                fill
                src={image.src}
              />
            </li>
          ))}
        </ul>
      )}

      {entry.tags.length === 0 ? null : (
        <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {entry.tags.map((tag) => (
            <li key={tag}>
              <Link
                className={`${focusRing} hover:underline`}
                href={`/blog/taxonomy/tag/${tag}`}
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const MicroPage = async ({ searchParams }: PageProps) => {
  const { page: rawPage } = await searchParams;
  const page = readPage(rawPage);

  const result = await serverCall.content.micro.list({
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">微言</h1>
        <p className="text-muted-foreground">
          {result.total} 条碎片，按发布时间从新到旧排列。
        </p>
      </header>

      {result.items.length === 0 ? (
        <div className="flex min-h-[45vh] items-center justify-center">
          <p className="text-muted-foreground w-full rounded-lg border border-dashed p-6">
            {result.total === 0 ? (
              <>
                还没有微言。短句、代码与图片发出来后，会按时间排在这里——先去{" "}
                <Link className={`${focusRing} underline`} href="/blog/archive">
                  归档
                </Link>{" "}
                读篇文章，或者回到{" "}
                <Link className={`${focusRing} underline`} href="/">
                  首页
                </Link>
                。
              </>
            ) : (
              <>
                这一页没有碎片了。{" "}
                <Link className={`${focusRing} underline`} href="/notes">
                  回到第一页
                </Link>
                。
              </>
            )}
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" data-slot="micro-list">
          {result.items.map((entry) => (
            <li key={entry.id}>
              <MicroEntry entry={entry} />
            </li>
          ))}
        </ol>
      )}

      <Pager
        currentPage={result.page}
        hrefFor={hrefFor}
        label="微言分页"
        totalPages={result.totalPages}
      />
    </div>
  );
};

export default MicroPage;
