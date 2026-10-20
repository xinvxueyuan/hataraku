import "@hataraku/ui/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "#src/components/header.tsx";
import { Providers } from "#src/components/providers.tsx";
import { SiteFooter } from "#src/components/site-footer.tsx";
import {
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_OG_LOCALE,
  SITE_TITLE,
  SITE_URL,
} from "#src/components/site.ts";

/**
 * Site metadata, inherited by every page that does not override a field.
 *
 * `metadataBase` makes the relative canonical and Open Graph URLs absolute, and the title template
 * turns a page's own title ("归档") into "归档 · 夜行栈" without each page repeating the suffix.
 * `url: "./"` is resolved against the current path, so every page reports its own address.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "./",
    types: {
      "application/atom+xml": "/atom.xml",
      "application/rss+xml": "/rss.xml",
    },
  },
  applicationName: SITE_TITLE,
  authors: [{ name: SITE_AUTHOR }],
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: SITE_OG_LOCALE,
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    type: "website",
    url: "./",
  },
  robots: { follow: true, index: true },
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  twitter: {
    card: "summary",
    description: SITE_DESCRIPTION,
    title: SITE_TITLE,
  },
};

const skipLinkClass =
  "sr-only rounded-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm";

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang={SITE_LOCALE} suppressHydrationWarning>
    <body>
      <Providers>
        <div className="flex min-h-svh flex-col">
          <a className={skipLinkClass} href="#content">
            跳到正文
          </a>
          <Header />
          <main
            className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14"
            id="content"
          >
            {children}
          </main>
          <SiteFooter />
        </div>
      </Providers>
    </body>
  </html>
);

export default RootLayout;
