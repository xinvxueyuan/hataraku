import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { PostEditor } from "#src/components/post-editor.tsx";
import {
  isForbidden,
  isMissingPost,
  requireSession,
} from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

type LoadedPost = Awaited<ReturnType<typeof serverCall.posts.byId>>;

const shell = (children: ReactNode) => (
  <section className="grid gap-6">
    <nav className="text-sm">
      <Link
        className="text-muted-foreground hover:underline"
        href="/settings/admin/posts"
      >
        ← 返回写作后台
      </Link>
    </nav>
    {children}
  </section>
);

/**
 * The editor page.
 *
 * `/settings/admin/posts/new` opens an empty form; every other id loads that post, drafts included.
 * A post that does not exist is a 404, and an account outside the allowlist gets the API's FORBIDDEN
 * rendered as a 403 page. The category list is public taxonomy, so the form can offer it before it
 * knows whether the caller may write.
 */
const AdminPostPage = async ({
  params,
}: PageProps<"/settings/admin/posts/[id]">) => {
  const { id } = await params;

  await requireSession("/settings/admin/posts");

  const categories = await serverCall.taxonomy.categories();

  if (id === "new") {
    return shell(
      <>
        <h1 className="text-3xl font-semibold tracking-tight">新建文章</h1>
        <PostEditor categories={categories} post={null} />
      </>
    );
  }

  let forbidden = false;
  let post: LoadedPost | null = null;

  try {
    post = await serverCall.posts.byId({ id });
  } catch (error) {
    if (isForbidden(error)) {
      forbidden = true;
    } else if (isMissingPost(error)) {
      notFound();
    } else {
      throw error;
    }
  }

  if (forbidden) {
    return <AdminForbidden />;
  }

  return shell(
    <>
      <h1 className="text-3xl font-semibold tracking-tight">编辑文章</h1>
      <PostEditor categories={categories} post={post} />
    </>
  );
};

export default AdminPostPage;
