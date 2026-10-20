"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";
import { Card } from "@hataraku/ui/components/card";

import { api } from "#src/lib/api.ts";

type ChangelogListInput = NonNullable<
  Parameters<typeof api.content.changelog.adminList.queryKey>[0]
>["input"];

/** One page of release entries. The list only deletes; editing lives on the entry's page. */
export const ChangelogList = ({
  filtered,
  input,
}: {
  filtered: boolean;
  input: ChangelogListInput;
}) => {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    api.content.changelog.adminList.queryOptions({ input })
  );

  const invalidate = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: api.content.key() });
    },
  };

  const remove = useMutation(
    api.content.changelog.remove.mutationOptions(invalidate)
  );

  if (data.items.length === 0) {
    return (
      <Card>
        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
          {filtered
            ? "没有匹配的更新日志。换个关键词或清掉筛选再看看。"
            : "还没有更新日志。发版时记一条，读者才知道改了什么。"}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y" data-slot="admin-changelog-list">
        {data.items.map((entry) => (
          <li
            className="flex flex-wrap items-center gap-3 px-4 py-3"
            key={entry.id}
          >
            <div className="grid min-w-0 flex-1 gap-0.5">
              <Link
                className="truncate font-medium hover:underline"
                href={`/settings/admin/changelog/${entry.id}`}
              >
                {entry.version}
                {entry.title === null ? "" : ` · ${entry.title}`}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {entry.releasedAt ?? "未定日期"} · {entry.changes.length} 条变更
                · /changelog/{entry.slug}
              </span>
            </div>

            {entry.highlight ? (
              <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                重点
              </span>
            ) : null}

            <Button
              onClick={() => {
                remove.mutate({ id: entry.id });
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
