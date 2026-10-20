import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { AdminPostList } from "#src/components/admin-post-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi } from "#src/server/query.ts";

/**
 * The posts index: every article with its status, newest edit first.
 *
 * The list is prefetched on the server and hydrated into the client list, which owns the publish and
 * delete actions. An account that is signed in but not on the allowlist gets the API's FORBIDDEN,
 * rendered as a 403 page rather than a crash.
 */
const AdminPostsPage = async () => {
  await requireSession("/settings/admin/posts");

  const queryClient = getQueryClient();
  let forbidden = false;

  try {
    await queryClient.query(serverApi.posts.adminList.queryOptions());
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
          href="/settings/admin/posts/new"
        >
          新建文章
        </Link>
      }
      current="/settings/admin/posts"
      description="文章存在 Postgres 里，正文是 MDX；保存和发布都走 API。"
      title="文章"
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminPostList />
      </HydrationBoundary>
    </AdminPageShell>
  );
};

export default AdminPostsPage;
