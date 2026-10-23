import type { Metadata } from "next";
import Link from "next/link";

import { focusRing } from "@hataraku/components/focus-ring";
import { Badge } from "@hataraku/ui/components/badge";

import { MediaImage } from "#src/components/media-image.tsx";
import { ToolboxSection } from "#src/components/toolbox-section.tsx";
import { serverCall } from "#src/server/query.ts";

/**
 * The friends list: the sites this one reads.
 *
 * A friend's avatar can arrive as an uploaded asset, as a remote URL, or as neither, so the card
 * falls back to the first character of the name instead of rendering a broken image.
 */

export const metadata: Metadata = {
  description: "常读的站点与写字的人。",
  title: "友链",
};

type Friend = Awaited<
  ReturnType<typeof serverCall.content.friends.list>
>[number];

const FriendCard = ({ friend }: { friend: Friend }) => {
  const avatarSource = friend.avatarUrl ?? friend.avatarKey;

  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span className="bg-muted relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {avatarSource === null ? (
            <span
              aria-hidden="true"
              className="text-muted-foreground text-sm font-semibold"
            >
              {friend.name.slice(0, 1)}
            </span>
          ) : (
            <MediaImage
              alt={`${friend.name} 的头像`}
              assetKey={friend.avatarKey}
              className="object-cover"
              fill
              src={friend.avatarUrl}
            />
          )}
        </span>
        <h2 className="font-medium">{friend.name}</h2>
      </div>

      {friend.description === null ? null : (
        <p className="text-muted-foreground text-sm">{friend.description}</p>
      )}

      {friend.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1">
          {friend.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="secondary">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}

      <a
        className={`${focusRing} mt-auto text-sm underline underline-offset-4`}
        href={friend.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        访问站点
      </a>
    </article>
  );
};

const FriendsPage = async () => {
  const friends = await serverCall.content.friends.list();

  return (
    <ToolboxSection
      count={`共 ${friends.length} 位朋友`}
      description="常读的站点与写字的人。"
      empty={
        <p className="text-muted-foreground rounded-lg border border-dashed p-6">
          还没有友链。等和更多写作者建立来往后再补上——先去{" "}
          <Link className={`${focusRing} underline`} href="/projects">
            项目
          </Link>{" "}
          或{" "}
          <Link className={`${focusRing} underline`} href="/notes">
            微言
          </Link>{" "}
          看看这个站点最近在做什么。
        </p>
      }
      hasItems={friends.length > 0}
      title="友链"
    >
      <ul className="grid gap-4 sm:grid-cols-2" data-slot="friend-list">
        {friends.map((friend) => (
          <li key={friend.id}>
            <FriendCard friend={friend} />
          </li>
        ))}
      </ul>
    </ToolboxSection>
  );
};

export default FriendsPage;
