import type { MetadataRoute } from "next";

import { absoluteUrl } from "#src/components/site.ts";

/** `/robots.txt` — public content is open; the interactive app routes are not content. */
const robots = (): MetadataRoute.Robots => ({
  host: absoluteUrl("/"),
  rules: {
    disallow: ["/login", "/settings/", "/todos"],
    userAgent: "*",
  },
  sitemap: absoluteUrl("/sitemap.xml"),
});

export default robots;
