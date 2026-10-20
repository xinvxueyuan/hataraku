"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";
import { Card } from "@hataraku/ui/components/card";

import { formatDay } from "#src/components/admin-dates.ts";
import { api } from "#src/lib/api.ts";

type MicroListInput = NonNullable<
  Parameters<typeof api.content.micro.adminList.queryKey>[0]
>["input"];

const excerpt = (content: string): string =>
  content.length > 60 ? `${content.slice(0, 60)}…` : content;

/**
 * One page of micro posts, drafts included, with the two actions the index needs: publish or take
 * down, and delete. Editing happens on the note's own page.
 */
export const MicroPostList = ({
  filtered,
  input,
}: {
  filtered: boolean;
  input: MicroListInput;
}) => {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    api.content.micro.adminList.queryOptions({ input })
  );

  const invalidate = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: api.content.key() });
    },
  };

  const publish = useMutation(
    api.content.micro.publish.mutationOptions(invalidate)
  );

  const unpublish = useMutation(
    api.content.micro.unpublish.mutationOptions(invalidate)
  );

  const remove = useMutation(
    api.content.micro.remove.mutationOptions(invalidate)
  );

  if (data.items.length === 0) {
    return (
      <Card>
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          {filtered
            ? "没有匹配的微言。换个关键词或清掉筛选再看看。"
            : "还没有微言。写一条，几十个字就够。"}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y" data-slot="admin-micro-list">
        {data.items.map((post) => (
          <li
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            key={post.id}
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link
                className="truncate font-medium hover:underline"
                href={`/settings/admin/micro/${post.id}`}
              >
                {excerpt(post.content)}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {post.type} · /micro/{post.slug} · {formatDay(post.publishedAt)}
              </span>
            </div>

            <span
              className={
                post.published
                  ? "bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium"
                  : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
              }
            >
              {post.published ? "已发布" : "草稿"}
            </span>

            <Button
              onClick={() => {
                const mutation = post.published ? unpublish : publish;

                mutation.mutate({ id: post.id });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {post.published ? "撤下" : "发布"}
            </Button>

            <Button
              onClick={() => {
                remove.mutate({ id: post.id });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              删除
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
};
