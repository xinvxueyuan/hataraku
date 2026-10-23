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
import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { ProjectList } from "#src/components/project-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi, serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/projects";
const PAGE_SIZE = 10;
const SORTS = ["updated", "published"] as const;
const STATUSES = ["active", "wip", "planned", "archived"] as const;

/** The projects index: search, filter by state or visibility, sort, one page at a time. */
const AdminProjectsPage = async ({
  searchParams,
}: PageProps<"/settings/admin/projects">) => {
  await requireSession(PATH);

  const params = await searchParams;
  const status = readAdminFilter(params.status, STATUSES);
  const published = readAdminBoolean(params.published);
  const sort = readAdminChoice(params.sort, SORTS, "updated");

  const input = {
    page: readAdminPage(params.page),
    pageSize: PAGE_SIZE,
    published,
    query: readAdminQuery(params.q),
    sort,
    status,
  };

  let forbidden = false;

  let list: Awaited<
    ReturnType<typeof serverCall.content.projects.adminList>
  > | null = null;

  try {
    list = await serverCall.content.projects.adminList(input);
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
    serverApi.content.projects.adminList.queryKey({ input }),
    list
  );

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        action={
          <Link
            className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
            href={`${PATH}/new`}
          >
            新建
          </Link>
        }
        description="做过的项目与实验，含状态、排序与封面。"
        title="项目"
      />
      <AdminListToolbar
        fields={[
          {
            label: "状态",
            name: "status",
            options: STATUSES.map((option) => ({
              label: option,
              value: option,
            })),
          },
          {
            label: "可见性",
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
              { label: "更新时间倒序", value: "updated" },
              { label: "发布时间倒序", value: "published" },
            ],
          },
        ]}
        hrefFor={(page) =>
          adminListHref(PATH, {
            page,
            published: input.published,
            q: input.query,
            sort: input.sort,
            status: input.status,
          })
        }
        label="项目分页"
        page={list.page}
        path={PATH}
        query={input.query}
        selected={{
          published:
            input.published === undefined ? undefined : String(input.published),
          sort: input.sort,
          status: input.status,
        }}
        total={list.total}
        totalPages={list.totalPages}
      />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProjectList
          filtered={
            input.query !== undefined ||
            status !== undefined ||
            published !== undefined
          }
          input={input}
        />
      </HydrationBoundary>
    </div>
  );
};

export default AdminProjectsPage;
