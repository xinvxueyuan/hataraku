import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { ChangelogList } from "#src/components/changelog-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi } from "#src/server/query.ts";

const PATH = "/settings/admin/changelog";

/**
 * The 更新日志 index: every row, drafts included. The list is prefetched on the server and hydrated
 * into the client list, which owns the publish and delete actions; an account outside the allowlist
 * gets the API's FORBIDDEN rendered as a 403 page.
 */
const AdminChangelogPage = async () => {
  await requireSession(PATH);

  const queryClient = getQueryClient();
  let forbidden = false;

  try {
    await queryClient.query(
      serverApi.content.changelog.adminList.queryOptions()
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
      description="每次发版记一条，读者能看懂改了什么。"
      title="更新日志"
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ChangelogList />
      </HydrationBoundary>
    </AdminPageShell>
  );
};

export default AdminChangelogPage;
