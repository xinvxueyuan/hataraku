import { notFound } from "next/navigation";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import {
  AdminBackLink,
  SettingsPageHeader,
} from "#src/components/admin-page-shell.tsx";
import { ProjectEditor } from "#src/components/project-editor.tsx";
import {
  isForbidden,
  isMissingPost,
  requireSession,
} from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/admin/projects";

type LoadedProject = Awaited<
  ReturnType<typeof serverCall.content.projects.byId>
>;

/**
 * The 项目 editor. `/new` opens an empty form; every other id loads that row. A row that does
 * not exist is a 404, and an account outside the allowlist gets the API's FORBIDDEN as a 403 page.
 */
const AdminProjectEditorPage = async ({
  params,
}: PageProps<"/settings/admin/projects/[id]">) => {
  const { id } = await params;

  await requireSession(PATH);

  if (id === "new") {
    return (
      <div className="grid gap-6" data-slot="settings-page">
        <SettingsPageHeader
          description="填好字段，保存后会跳到它的编辑页。"
          title="新建项目"
        />
        <AdminBackLink href={PATH} />
        <ProjectEditor project={null} />
      </div>
    );
  }

  let forbidden = false;
  let row: LoadedProject | null = null;

  try {
    row = await serverCall.content.projects.byId({ id });
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
        description="改一个项目的状态、封面与详情。"
        title="编辑项目"
      />
      <AdminBackLink href={PATH} />
      <ProjectEditor project={row} />
    </div>
  );
};

export default AdminProjectEditorPage;
