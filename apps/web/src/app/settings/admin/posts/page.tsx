import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import Link from "next/link";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPostList } from "#src/components/admin-post-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { getQueryClient, serverApi } from "#src/server/query.ts";

/**
 * The writing index: every post with its status, newest edit first.
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
    <section className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">写作后台</h1>
          <p className="text-muted-foreground text-sm">
            文章存在 Postgres 里，正文是 MDX；保存和发布都走 API。
          </p>
        </div>
        <Link
          className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          href="/settings/admin/posts/new"
        >
          新建文章
        </Link>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminPostList />
      </HydrationBoundary>
    </section>
  );
};

export default AdminPostsPage;
