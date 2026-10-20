/**
 * Turns a stored media key into the URL a browser can load.
 *
 * Rows carry R2 object keys (`albums/example/1.webp`) because the bucket owns the object name; only
 * the reader needs a URL. The public host is deployment configuration (`R2_PUBLIC_BASE_URL`) — the
 * bucket domain is a deployment detail, so no host is baked into the code. An absolute URL stored
 * on a row passes through unchanged; with no configured base, a bare key has no address yet.
 */
const mediaBaseUrl = (): string | null => {
  const configured = process.env.R2_PUBLIC_BASE_URL?.trim() ?? "";

  return configured === "" ? null : configured.replace(/\/+$/u, "");
};

/** Absolute URLs and site-relative paths pass through; a bare key joins the configured media host. */
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

  const base = mediaBaseUrl();

  return base === null ? null : `${base}/${value.replace(/^\/+/u, "")}`;
};
