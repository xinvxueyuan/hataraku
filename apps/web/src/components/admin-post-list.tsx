"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";
import { Card } from "@hataraku/ui/components/card";

import { contentPath } from "#src/components/content-path.ts";
import { api } from "#src/lib/api.ts";

/** The list's input, taken from the client's own contract so the page cannot pass a wrong shape. */
type PostsListInput = NonNullable<
  Parameters<typeof api.posts.adminList.queryKey>[0]
>["input"];

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

const formatDate = (value: Date | null): string =>
  value === null ? "—" : dateFormatter.format(value);

const statusClassName = (status: "draft" | "published"): string =>
  status === "published"
    ? "bg-success/15 text-success rounded-full px-2 py-0.5 text-xs font-medium"
    : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium";

/**
 * One page of posts, drafts included, with the two actions the index needs: publish or unpublish,
 * and delete. Editing happens on its own page, so the title is a link.
 */
export const AdminPostList = ({
  filtered,
  input,
}: {
  filtered: boolean;
  input: PostsListInput;
}) => {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    api.posts.adminList.queryOptions({ input })
  );

  const invalidate = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: api.posts.key() });
    },
  };

  const publish = useMutation(api.posts.publish.mutationOptions(invalidate));

  const unpublish = useMutation(
    api.posts.unpublish.mutationOptions(invalidate)
  );

  const remove = useMutation(api.posts.remove.mutationOptions(invalidate));

  if (data.items.length === 0) {
    return (
      <Card>
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          {filtered
            ? "没有匹配的文章。换个关键词或清掉筛选再看看。"
            : "还没有文章。新建一篇，写点什么。"}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y" data-slot="admin-post-list">
        {data.items.map((post) => (
          <li
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            key={post.id}
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link
                className="truncate font-medium hover:underline"
                href={`/settings/admin/posts/${post.id}`}
              >
                {post.title}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {contentPath("/blog", post)} · 更新于{" "}
                {formatDate(post.updatedAt)}
              </span>
            </div>

            <span className={statusClassName(post.status)}>
              {post.status === "published" ? "已发布" : "草稿"}
            </span>

            <Button
              onClick={() => {
                const mutation =
                  post.status === "published" ? unpublish : publish;

                mutation.mutate({ id: post.id });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {post.status === "published" ? "撤下" : "发布"}
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
