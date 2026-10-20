import Link from "next/link";

import { ModeToggle } from "#src/components/mode-toggle.tsx";
import { MobileNav, NavLinks } from "#src/components/nav-links.tsx";
import { SITE_NAME } from "#src/components/site.ts";
import { UserMenu } from "#src/components/user-menu.tsx";
import { getSession } from "#src/server/session.ts";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/**
 * The site header: brand, main navigation, account and theme controls.
 *
 * The navigation collapses into a `<details>` disclosure on narrow screens. It is opened by click,
 * Enter or Space and the links inside are ordinary tab stops — the menu never depends on hover, so
 * it works with a keyboard and a touch screen alike.
 */
export const Header = async () => {
  const session = await getSession();

  return (
    <header className="bg-background/80 sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link
          className={`${focusRing} flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight`}
          href="/"
        >
          <span aria-hidden="true" className="bg-primary size-2.5 rounded-sm" />
          {SITE_NAME}
        </Link>

        <div className="hidden md:block">
          <NavLinks label="主导航" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu user={session?.user ?? null} />
          <ModeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
};
