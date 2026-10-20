import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { ProjectList } from "#src/components/project-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi } from "#src/server/query.ts";

const PATH = "/settings/admin/projects";

/**
 * The 项目 index: every row, drafts included. The list is prefetched on the server and hydrated
 * into the client list, which owns the publish and delete actions; an account outside the allowlist
 * gets the API's FORBIDDEN rendered as a 403 page.
 */
const AdminProjectsPage = async () => {
  await requireSession(PATH);

  const queryClient = getQueryClient();
  let forbidden = false;

  try {
    await queryClient.query(
      serverApi.content.projects.adminList.queryOptions()
    );
  } catch (error) {
    if (isForbidden(error)) {
      forbidden = true;
    } else {
      throw error;
    }
  }

  if (forbidden) {
    return <AdminForbidden />;
  }

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
      description="做过的项目与实验，含状态、排序与封面。"
      title="项目"
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProjectList />
      </HydrationBoundary>
    </AdminPageShell>
  );
};

export default AdminProjectsPage;
