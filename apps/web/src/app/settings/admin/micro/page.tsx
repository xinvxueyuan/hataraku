import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  adminListHref,
  readAdminBoolean,
  readAdminChoice,
  readAdminFilter,
  readAdminPage,
  readAdminQuery,
} from "#src/components/admin-list-query.ts";
import { AdminListToolbar } from "#src/components/admin-list-toolbar.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { MicroPostList } from "#src/components/micro-post-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi, serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/micro";
const PAGE_SIZE = 10;
const SORTS = ["published", "created"] as const;
const TYPES = ["text", "code", "image", "dialogue", "music", "link"] as const;

/** The micro index: search, filter by kind or visibility, sort, one page at a time. */
const AdminMicroPage = async ({
  searchParams,
}: PageProps<"/settings/admin/micro">) => {
  await requireSession(PATH);

  const params = await searchParams;
  const type = readAdminFilter(params.type, TYPES);
  const published = readAdminBoolean(params.published);
  const sort = readAdminChoice(params.sort, SORTS, "published");

  const input = {
    page: readAdminPage(params.page),
    pageSize: PAGE_SIZE,
    published,
    query: readAdminQuery(params.q),
    sort,
    type,
  };

  let forbidden = false;

  let list: Awaited<
    ReturnType<typeof serverCall.content.micro.adminList>
  > | null = null;

  try {
    list = await serverCall.content.micro.adminList(input);
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
    serverApi.content.micro.adminList.queryKey({ input }),
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
      current={PATH}
      description="短句与碎片，前台在 /micro。"
      title="微言"
    >
      <AdminListToolbar
        fields={[
          {
            label: "类型",
            name: "type",
            options: TYPES.map((option) => ({ label: option, value: option })),
          },
          {
            label: "状态",
            name: "published",
            options: [
              { label: "已发布", value: "true" },
              { label: "草稿", value: "false" },
            ],
          },
          {
            label: "排序",
            name: "sort",
            options: [
              { label: "发布时间倒序", value: "published" },
              { label: "创建时间倒序", value: "created" },
            ],
          },
        ]}
        hrefFor={(page) =>
          adminListHref(PATH, {
            page,
            published: input.published,
            q: input.query,
            sort: input.sort,
            type: input.type,
          })
        }
        label="微言分页"
        page={list.page}
        path={PATH}
        query={input.query}
        selected={{
          published:
            input.published === undefined ? undefined : String(input.published),
          sort: input.sort,
          type: input.type,
        }}
        total={list.total}
        totalPages={list.totalPages}
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <MicroPostList
          filtered={
            input.query !== undefined ||
            type !== undefined ||
            published !== undefined
          }
          input={input}
        />
      </HydrationBoundary>
    </AdminPageShell>
  );
};

export default AdminMicroPage;
