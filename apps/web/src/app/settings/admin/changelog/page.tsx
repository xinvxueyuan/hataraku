import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  adminListHref,
  readAdminBoolean,
  readAdminChoice,
  readAdminPage,
  readAdminQuery,
} from "#src/components/admin-list-query.ts";
import { AdminListToolbar } from "#src/components/admin-list-toolbar.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { ChangelogList } from "#src/components/changelog-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi, serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/changelog";
const PAGE_SIZE = 10;
const SORTS = ["released", "created"] as const;

/** The changelog index: search, filter to highlighted releases, sort, one page at a time. */
const AdminChangelogPage = async ({
  searchParams,
}: PageProps<"/settings/admin/changelog">) => {
  await requireSession(PATH);

  const params = await searchParams;
  const highlight = readAdminBoolean(params.highlight);
  const sort = readAdminChoice(params.sort, SORTS, "released");

  const input = {
    highlight,
    page: readAdminPage(params.page),
    pageSize: PAGE_SIZE,
    query: readAdminQuery(params.q),
    sort,
  };

  let forbidden = false;

  let list: Awaited<
    ReturnType<typeof serverCall.content.changelog.adminList>
  > | null = null;

  try {
    list = await serverCall.content.changelog.adminList(input);
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

  queryClient.setQueryData(
    serverApi.content.changelog.adminList.queryKey({ input }),
    list
  );

  return (
    <AdminPageShell
      action={
        <Link
          className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          href={`${PATH}/new`}
        >
          新建
        </Link>
      }
      description="每次发版记一条，读者能看懂改了什么。"
      title="更新日志"
    >
      <AdminListToolbar
        fields={[
          {
            label: "重点",
            name: "highlight",
            options: [
              { label: "只看重点版本", value: "true" },
              { label: "只看普通版本", value: "false" },
            ],
          },
          {
            label: "排序",
            name: "sort",
            options: [
              { label: "发布时间倒序", value: "released" },
              { label: "创建时间倒序", value: "created" },
            ],
          },
        ]}
        hrefFor={(page) =>
          adminListHref(PATH, {
            highlight: input.highlight,
            page,
            q: input.query,
            sort: input.sort,
          })
        }
        label="更新日志分页"
        page={list.page}
        path={PATH}
        query={input.query}
        selected={{
          highlight:
            input.highlight === undefined ? undefined : String(input.highlight),
          sort: input.sort,
        }}
        total={list.total}
        totalPages={list.totalPages}
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ChangelogList
          filtered={input.query !== undefined || highlight !== undefined}
          input={input}
        />
      </HydrationBoundary>
    </AdminPageShell>
  );
};

export default AdminChangelogPage;
