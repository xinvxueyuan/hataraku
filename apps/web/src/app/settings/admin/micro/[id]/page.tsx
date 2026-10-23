import { notFound } from "next/navigation";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  AdminBackLink,
  AdminPageShell,
} from "#src/components/admin-page-shell.tsx";
import { MicroPostEditor } from "#src/components/micro-post-editor.tsx";
import {
  isForbidden,
  isMissingPost,
  requireSession,
} from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/micro";

type LoadedMicroPost = Awaited<
  ReturnType<typeof serverCall.content.micro.byId>
>;

/**
 * The 微言 editor. `/new` opens an empty form; every other id loads that row. A row that does
 * not exist is a 404, and an account outside the allowlist gets the API's FORBIDDEN as a 403 page.
 */
const AdminMicroEditorPage = async ({
  params,
}: PageProps<"/settings/admin/micro/[id]">) => {
  const { id } = await params;

  await requireSession(PATH);

  if (id === "new") {
    return (
      <AdminPageShell
        description="填好字段，保存后会跳到它的编辑页。"
        title="新建微言"
      >
        <AdminBackLink href={PATH} />
        <MicroPostEditor post={null} />
      </AdminPageShell>
    );
  }

  let forbidden = false;
  let row: LoadedMicroPost | null = null;

  try {
    row = await serverCall.content.micro.byId({ id });
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

  return (
    <AdminPageShell description="改一条已经写下的短句。" title="编辑微言">
      <AdminBackLink href={PATH} />
      <MicroPostEditor post={row} />
    </AdminPageShell>
  );
};

export default AdminMicroEditorPage;
