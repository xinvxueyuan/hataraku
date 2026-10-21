import type { AnalyticsProvider } from "@hataraku/db/schema/json";

/**
 * What the owner configured, as the injector reads it.
 *
 * The stored value is trusted only as far as the profile write validated it: the checks below run
 * again here, because the row can be hand-edited in the database and a script tag is too sharp an
 * edge to trust a convention.
 */
export interface AnalyticsSettings {
  enabled: boolean;
  provider: AnalyticsProvider;
  respectDnt: boolean;
  scriptSrc: string;
  siteId: string;
}

export interface AnalyticsScript {
  provider: Exclude<AnalyticsProvider, "none">;
  respectDnt: boolean;
  siteId: string;
  src: string;
}

/** The hosted defaults, used when the owner did not name a self-hosted script. */
const DEFAULT_SOURCES = {
  plausible: "https://plausible.io/js/script.js",
  umami: "https://cloud.umami.is/script.js",
} as const;

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * The script to inject, or `null` for every state that must load nothing.
 *
 * Off, provider `none`, a missing site id, or a source that is not https all answer `null` — the
 * disabled state is not "render and let the provider ignore it", it is no tag at all.
 */
export const resolveAnalyticsScript = (
  settings: AnalyticsSettings | null | undefined
): AnalyticsScript | null => {
  if (settings === null || settings === undefined || !settings.enabled) {
    return null;
  }

  if (settings.provider === "none") {
    return null;
  }

  const shared = {
    provider: settings.provider,
    respectDnt: settings.respectDnt,
    siteId: settings.siteId,
  };

  if (settings.provider === "custom") {
    return isHttpsUrl(settings.scriptSrc)
      ? { ...shared, src: settings.scriptSrc }
      : null;
  }

  if (settings.siteId === "") {
    return null;
  }

  if (settings.provider === "google") {
    return {
      ...shared,
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(settings.siteId)}`,
    };
  }

  const src =
    settings.scriptSrc === ""
      ? DEFAULT_SOURCES[settings.provider]
      : settings.scriptSrc;

  return isHttpsUrl(src) ? { ...shared, src } : null;
};
