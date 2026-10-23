import { notFound } from "next/navigation";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  AdminBackLink,
  SettingsPageHeader,
} from "#src/components/admin-page-shell.tsx";
import { ChangelogEditor } from "#src/components/changelog-editor.tsx";
import {
  isForbidden,
  isMissingPost,
  requireSession,
} from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/changelog";

type LoadedChangelogEntry = Awaited<
  ReturnType<typeof serverCall.content.changelog.byId>
>;

/**
 * The 更新日志 editor. `/new` opens an empty form; every other id loads that row. A row that does
 * not exist is a 404, and an account outside the allowlist gets the API's FORBIDDEN as a 403 page.
 */
const AdminChangelogEditorPage = async ({
  params,
}: PageProps<"/settings/admin/changelog/[id]">) => {
  const { id } = await params;

  await requireSession(PATH);

  if (id === "new") {
    return (
      <div className="grid gap-6" data-slot="settings-page">
        <SettingsPageHeader
          description="填好字段，保存后会跳到它的编辑页。"
          title="新建更新日志"
        />
        <AdminBackLink href={PATH} />
        <ChangelogEditor entry={null} />
      </div>
    );
  }

  let forbidden = false;
  let row: LoadedChangelogEntry | null = null;

  try {
    row = await serverCall.content.changelog.byId({ id });
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
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        description="改一条版本记录的条目与正文。"
        title="编辑更新日志"
      />
      <AdminBackLink href={PATH} />
      <ChangelogEditor entry={row} />
    </div>
  );
};

export default AdminChangelogEditorPage;
