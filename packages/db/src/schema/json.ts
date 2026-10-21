/** JSONB payload shapes shared by more than one table. */

/** The home hero block on the site profile. */
export interface HeroMeta {
  badge?: string;
  cta?: string;
  ctaHref?: string;
  description?: string;
  meta?: string;
  title?: string;
}

/**
 * The third-party analytics the owner may switch on for the public site.
 *
 * The column always carries every field so the form and the reader agree on the shape; "off" is
 * `enabled: false`, not a missing object. `respectDnt` defaults to true: a visitor who asked not to
 * be tracked is not tracked unless the owner deliberately opts out.
 */
export type AnalyticsProvider =
  | "none"
  | "umami"
  | "plausible"
  | "google"
  | "custom";

export interface AnalyticsConfig {
  enabled: boolean;
  provider: AnalyticsProvider;
  respectDnt: boolean;
  /** Only used by the `custom` provider; empty otherwise. Always https. */
  scriptSrc: string;
  /** The site id the provider issued; empty when not configured. */
  siteId: string;
}

/** A music entry on a micro post. */
export interface MusicMeta {
  album?: string;
  artist?: string;
  coverKey?: string;
  track?: string;
  url?: string;
}
