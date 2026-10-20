/** JSONB payload shapes shared by more than one table. */

/** Cover image metadata, as the old site's frontmatter carried it. */
export interface CoverMeta {
  alt?: string;
  height?: number;
  src: string;
  width?: number;
}

/** The home hero block on the site profile. */
export interface HeroMeta {
  badge?: string;
  cta?: string;
  ctaHref?: string;
  description?: string;
  meta?: string;
  title?: string;
}

/** The navigation call to action on the site profile. */
export interface NavMeta {
  cta?: { href: string; label: string };
}

/** A music entry on a micro post. */
export interface MusicMeta {
  album?: string;
  artist?: string;
  coverKey?: string;
  track?: string;
  url?: string;
}
