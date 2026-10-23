import { redirect } from "next/navigation";

import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { TwoFactorSetup } from "#src/components/two-factor-setup.tsx";
import { getSession } from "#src/server/session.ts";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * Better Auth's session payload carries the two-factor plugin's twoFactorEnabled user field, but
 * the web app builds its own auth client without that plugin, so its session type stops at the core
 * fields. Read the field at runtime instead of asserting a shape the compiler cannot see.
 */
const isTwoFactorEnabled = (user: Session["user"]) =>
  "twoFactorEnabled" in user && user.twoFactorEnabled === true;

const TwoFactorPage = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=%2Fsettings%2Ftwo-factor");
  }

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        description="Protect your account with a code from an authenticator app."
        title="Two-factor authentication"
      />
      <TwoFactorSetup enabled={isTwoFactorEnabled(session.user)} />
    </div>
  );
};

export default TwoFactorPage;
