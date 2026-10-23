import type { Metadata } from "next";

import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { loadSiteProfile } from "#src/components/site-content.ts";
import { SiteProfileForm } from "#src/components/site-profile-form.tsx";
import { requireSession } from "#src/server/admin.ts";

export const metadata: Metadata = {
  description: "站点名称、简介、社交链接与首页 Hero。",
  robots: { follow: false, index: false },
  title: "站点资料",
};

/**
 * The profile editor. The row is read on the server and handed to the client form; the save goes
 * through `site.updateProfile`, which is where the write permission and the validation live.
 */
const SiteProfilePage = async () => {
  await requireSession("/settings/admin/profile");

  const profile = await loadSiteProfile();

  return (
    <AdminPageShell
      description="站点名称、简介、社交链接与首页 Hero；保存后首页、页脚与关于页立即生效。"
      title="站点资料"
    >
      <SiteProfileForm profile={profile} />
    </AdminPageShell>
  );
};

export default SiteProfilePage;
