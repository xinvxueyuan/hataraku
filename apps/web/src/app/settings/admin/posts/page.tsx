import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  adminListHref,
  readAdminChoice,
  readAdminFilter,
  readAdminPage,
  readAdminQuery,
} from "#src/components/admin-list-query.ts";
import { AdminListToolbar } from "#src/components/admin-list-toolbar.tsx";
import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { AdminPostList } from "#src/components/admin-post-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi, serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/posts";
const PAGE_SIZE = 10;
const SORTS = ["updated", "published"] as const;
const STATUSES = ["draft", "published"] as const;

/**
 * The posts index: search, filter, sort and one page at a time.
 *
 * The query string is the whole state — the page reads it, the procedure filters on it, and every
 * link keeps it — so a filtered page is a URL that can be shared or bookmarked.
 */
const AdminPostsPage = async ({
  searchParams,
}: PageProps<"/settings/admin/posts">) => {
  await requireSession(PATH);

  const params = await searchParams;
  const status = readAdminFilter(params.status, STATUSES);
  const sort = readAdminChoice(params.sort, SORTS, "updated");

  const input = {
    page: readAdminPage(params.page),
    pageSize: PAGE_SIZE,
    query: readAdminQuery(params.q),
    sort,
    status,
  };

  let forbidden = false;

  let list: Awaited<ReturnType<typeof serverCall.posts.adminList>> | null =
    null;

  try {
    list = await serverCall.posts.adminList(input);
  } catch (error) {
    if (isForbidden(error)) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden || list === null) {
    return <AdminForbidden />;
  }

  const queryClient = getQueryClient();

  queryClient.setQueryData(serverApi.posts.adminList.queryKey({ input }), list);

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        action={
          <Link
            className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
            href="/settings/admin/posts/new"
          >
            新建文章
          </Link>
        }
        description="文章存在 Postgres 里，正文是 MDX；保存和发布都走 API。"
        title="文章"
      />
      <AdminListToolbar
        fields={[
          {
            label: "状态",
            name: "status",
            options: [
              { label: "草稿", value: "draft" },
              { label: "已发布", value: "published" },
            ],
          },
          {
            label: "排序",
            name: "sort",
            options: [
              { label: "更新时间倒序", value: "updated" },
              { label: "发布时间倒序", value: "published" },
            ],
          },
        ]}
        hrefFor={(page) =>
          adminListHref(PATH, {
            page,
            q: input.query,
            sort: input.sort,
            status: input.status,
          })
        }
        label="文章分页"
        page={list.page}
        path={PATH}
        query={input.query}
        selected={{ sort: input.sort, status: input.status }}
        total={list.total}
        totalPages={list.totalPages}
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminPostList
          filtered={input.query !== undefined || status !== undefined}
          input={input}
        />
      </HydrationBoundary>
    </div>
  );
};

export default AdminPostsPage;
