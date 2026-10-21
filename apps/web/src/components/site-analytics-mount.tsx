import { SiteAnalytics } from "#src/components/site-analytics.tsx";
import { loadAnalyticsSettings } from "#src/components/site-content.ts";

/**
 * Reads the owner's analytics settings and hands them to the client component.
 *
 * A server wrapper rather than a read inside the layout: the layout stays synchronous, and the one
 * place that needs the settings is the place that fetches them.
 */
export const SiteAnalyticsMount = async () => (
  <SiteAnalytics settings={await loadAnalyticsSettings()} />
);
