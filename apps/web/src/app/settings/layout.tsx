import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SettingsSidebar } from "#src/components/admin-nav.tsx";
import { requireSession } from "#src/server/admin.ts";

/**
 * The settings frame is rendered once for every settings route. Only the page content changes, so
 * client navigation keeps the sidebar mounted and the surface does not look like a new orphan page.
 */
/** The proxy only sets x-pathname for this section, so the path itself is the safe login target. */
const loginTargetFor = (pathname: string) =>
  pathname.startsWith("/settings") ? pathname : "/settings/admin";

const SettingsLayout = async ({ children }: { children: ReactNode }) => {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "/settings/admin";

  await requireSession(loginTargetFor(pathname));

  return (
    <section
      className="relative left-1/2 w-full max-w-4xl -translate-x-1/2"
      data-slot="admin-shell"
    >
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <aside
          className="lg:sticky lg:top-20 lg:self-start"
          data-slot="admin-sidebar"
        >
          <SettingsSidebar />
        </aside>

        <div className="grid min-w-0 gap-6" data-slot="admin-content">
          {children}
        </div>
      </div>
    </section>
  );
};

export default SettingsLayout;
