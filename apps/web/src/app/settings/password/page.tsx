import type { Metadata } from "next";

import { PASSWORD_MIN_LENGTH } from "@hataraku/auth";

import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { ChangePasswordForm } from "#src/components/change-password-form.tsx";
import { requireSession } from "#src/server/admin.ts";

export const metadata: Metadata = {
  description: "修改当前账号的登录密码。",
  robots: { follow: false, index: false },
  title: "修改密码",
};

/**
 * The password page. Better Auth's `/change-password` is the boundary — it verifies the current
 * password, enforces the length policy and revokes the other sessions — and this page only asks for
 * the three values and renders the answer.
 */
const PasswordPage = async () => {
  const session = await requireSession("/settings/password");

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        description={`当前账号：${session.user.email}`}
        title="修改密码"
      />
      <ChangePasswordForm minLength={PASSWORD_MIN_LENGTH} />
    </div>
  );
};

export default PasswordPage;
