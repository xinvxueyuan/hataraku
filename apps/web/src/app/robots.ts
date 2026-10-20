import type { MetadataRoute } from "next";

import { absoluteUrl, siteOriginFromEnv } from "#src/components/site.ts";

/**
 * `/robots.txt` — public content is open; the interactive app routes are not content.
 *
 * `robots.txt` is pre-rendered, so it reads the configured origin rather than a request. Without a
 * configured origin the file still states the rules and simply omits the absolute sitemap line
 * instead of inventing a host.
 */
const robots = (): MetadataRoute.Robots => {
  const origin = siteOriginFromEnv();

  const rules: MetadataRoute.Robots["rules"] = {
    disallow: ["/login", "/settings/", "/todos"],
    userAgent: "*",
  };

  if (origin === null) {
    return { rules };
  }

  return {
    host: absoluteUrl(origin, "/"),
    rules,
    sitemap: absoluteUrl(origin, "/sitemap.xml"),
  };
};

export default robots;
