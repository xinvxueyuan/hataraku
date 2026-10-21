import "@hataraku/ui/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "#src/components/header.tsx";
import { Providers } from "#src/components/providers.tsx";
import { SiteAnalyticsMount } from "#src/components/site-analytics-mount.tsx";
import { loadSiteIdentity } from "#src/components/site-content.ts";
import { SiteFooter } from "#src/components/site-footer.tsx";
import {
  absoluteUrl,
  SITE_LOCALE,
  SITE_OG_LOCALE,
  siteOrigin,
} from "#src/components/site.ts";

/**
 * Site metadata, inherited by every page that does not override a field.
 *
 * The names come from the site profile, through the same `loadSiteIdentity()` the header and the
 * footer read: the identity falls back to the `SITE_*` constants when the row (or a column) is
 * missing, so a fresh database renders the same title a configured one does. The helper is wrapped
 * in React `cache`, and the docs name exactly this case — "React `cache` can be used if `fetch` is
 * unavailable" — so `generateMetadata` and the layout body share one profile read per request.
 *
 * `metadataBase` makes the relative canonical and Open Graph URLs absolute, and the title template
 * turns a page's own title ("归档") into "归档 · 夜行栈" without each page repeating the suffix.
 * `url: "./"` is resolved against the current path, so every page reports its own address.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const [origin, site] = await Promise.all([siteOrigin(), loadSiteIdentity()]);

  const card = new URLSearchParams({
    description: site.tagline ?? site.description,
    title: site.title,
  });

  const image = absoluteUrl(origin, `/api/og?${card.toString()}`);

  return {
    alternates: {
      canonical: "./",
      types: {
        "application/atom+xml": "/atom.xml",
        "application/rss+xml": "/rss.xml",
      },
    },
    applicationName: site.title,
    authors: [{ name: site.author }],
    description: site.description,
    metadataBase: new URL(origin),
    openGraph: {
      description: site.description,
      images: [{ alt: site.title, height: 630, url: image, width: 1200 }],
      locale: SITE_OG_LOCALE,
      siteName: site.title,
      title: site.title,
      type: "website",
      url: "./",
    },
    robots: { follow: true, index: true },
    title: { default: site.title, template: `%s · ${site.name}` },
    twitter: {
      card: "summary_large_image",
      description: site.description,
      images: [image],
      title: site.title,
    },
  };
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
            className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 has-[[data-slot=portal]]:max-w-6xl sm:py-14"
            id="content"
          >
            {children}
          </main>
          <SiteFooter />
        </div>
      </Providers>
      <SiteAnalyticsMount />
    </body>
  </html>
);

export default RootLayout;
