/**
 * Turns a stored media key into the URL a browser can load.
 *
 * Rows carry R2 object keys (`albums/acg-example/1.webp`) because the bucket is the source of
 * truth for the object name; only the reader needs a URL. The public host is the one the migrated
 * `cover.src` values already point at, and a deployment that fronts the bucket elsewhere overrides
 * it with `NEXT_PUBLIC_MEDIA_BASE_URL` (a public host, never a credential).
 */
const FALLBACK_MEDIA_BASE_URL = "https://cdn.xinvstar.xyz";

const mediaBaseUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

  if (configured === undefined || configured.trim() === "") {
    return FALLBACK_MEDIA_BASE_URL;
  }

  return configured.trim().replace(/\/+$/u, "");
};

/** Absolute URLs and site-relative paths pass through; a bare key joins the media host. */
export const assetUrl = (key: string | null | undefined): string | null => {
  if (key === null || key === undefined) {
    return null;
  }

  const value = key.trim();

  if (value === "") {
    return null;
  }

  if (/^(?:https?:)?\/\//u.test(value) || value.startsWith("/")) {
    return value;
  }

  return `${mediaBaseUrl()}/${value.replace(/^\/+/u, "")}`;
};
