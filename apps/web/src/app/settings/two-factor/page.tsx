import { redirect } from "next/navigation";

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
    <section className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-muted-foreground text-sm">
          Protect your account with a code from an authenticator app.
        </p>
      </div>
      <TwoFactorSetup enabled={isTwoFactorEnabled(session.user)} />
    </section>
  );
};

export default TwoFactorPage;
