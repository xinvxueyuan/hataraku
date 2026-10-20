import { headers } from "next/headers";

/**
 * Site identity and the formatting helpers shared by the shell and the machine endpoints.
 *
 * Nothing here names a domain: the public address is deployment configuration. `BETTER_AUTH_URL`
 * is the configured origin, and a request that carries no configured origin falls back to the host
 * the reader actually used, so a domain change is an environment change, not a code change.
 */
export const SITE_NAME = "夜行栈";
const SITE_NAME_EN = "NightStack";
export const SITE_TITLE = `${SITE_NAME} ${SITE_NAME_EN}`;

export const SITE_DESCRIPTION =
  "夜行栈：把代码、学习与生活编排成一片可阅读的个人星图。";

export const SITE_TAGLINE = "昼 · 清醒记录构建 / 夜 · 沉浸漫游沉思";
export const SITE_LOCALE = "zh-CN";
export const SITE_LANGUAGE = "zh-CN";

/** `openGraph.locale` wants the underscore form; `<html lang>` wants the hyphenated one. */
export const SITE_OG_LOCALE = "zh_CN";

/** Fallbacks used only when the site profile row is missing. */
export const SITE_AUTHOR = "xinvStar";
export const SITE_EMAIL = "xinvxueyuan@yeah.net";

const SITE_TIME_ZONE = "Asia/Shanghai";

/** Shanghai has been a fixed +08:00 since 1991, so the offset is a constant, not a lookup. */
const SHANGHAI_OFFSET = "+0800";

const normalizeOrigin = (value: string | undefined): string | null => {
  const configured = value?.trim() ?? "";

  if (configured === "") {
    return null;
  }

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
};

/**
 * The configured origin, for callers that run without a request (the static `robots.txt` route).
 * `null` means this deployment has not named its address yet, and a caller must not invent one.
 */
export const siteOriginFromEnv = (): string | null =>
  normalizeOrigin(process.env.BETTER_AUTH_URL);

/**
 * The origin this request is served from.
 *
 * The configured origin wins because it is trusted configuration; the forwarded host is the
 * fallback for previews and local runs, where the deployment may not set one yet. An unknown
 * origin is an error rather than a relative URL, because feeds and the sitemap must be absolute.
 */
export const siteOrigin = async (): Promise<string> => {
  const configured = siteOriginFromEnv();

  if (configured !== null) {
    return configured;
  }

  const requestHeaders = await headers();

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (host !== null && host !== "") {
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

    return `${protocol}://${host}`;
  }

  throw new Error(
    "Set BETTER_AUTH_URL (or serve the site through a host header) so its public origin is known."
  );
};

export const absoluteUrl = (origin: string, path: string): string =>
  origin + (path.startsWith("/") ? path : "/" + path);

const XML_ENTITIES = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&apos;"],
]);

/** XML 1.0 allows tab, newline, carriage return and the printable range only. */
const isLegalXmlCharacter = (codePoint: number): boolean =>
  codePoint === 0x09 ||
  codePoint === 0x0a ||
  codePoint === 0x0d ||
  (codePoint >= 0x20 && codePoint !== 0xff_fe && codePoint !== 0xff_ff);

/** Escapes text for XML and drops the characters XML 1.0 cannot represent. */
const legalXmlChars = (value: string): string => {
  let sanitized = "";

  for (const character of value) {
    if (isLegalXmlCharacter(character.codePointAt(0) ?? 0)) {
      sanitized += character;
    }
  }

  return sanitized;
};

export const escapeXml = (value: string): string =>
  legalXmlChars(value).replaceAll(
    /[<>&"']/gu,
    (character) => XML_ENTITIES.get(character) ?? character
  );

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
});

const rfc822Formatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "short",
  second: "2-digit",
  timeZone: SITE_TIME_ZONE,
  weekday: "short",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
});

const partOf = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string => parts.find((part) => part.type === type)?.value ?? "";

/** `Sat, 17 Oct 2026 08:00:00 +0800` — RSS 2.0 pubDate keeps the site's wall clock. */
export const rfc822 = (date: Date): string => {
  const parts = rfc822Formatter.formatToParts(date);

  return `${partOf(parts, "weekday")}, ${partOf(parts, "day")} ${partOf(
    parts,
    "month"
  )} ${partOf(parts, "year")} ${partOf(parts, "hour")}:${partOf(
    parts,
    "minute"
  )}:${partOf(parts, "second")} ${SHANGHAI_OFFSET}`;
};

/** `2026-10-17T08:00:00+08:00` — Atom's RFC 3339 timestamps in the same zone. */
export const rfc3339 = (date: Date): string => {
  const parts = dateTimeFormatter.formatToParts(date);

  return `${partOf(parts, "year")}-${partOf(parts, "month")}-${partOf(
    parts,
    "day"
  )}T${partOf(parts, "hour")}:${partOf(parts, "minute")}:${partOf(
    parts,
    "second"
  )}+08:00`;
};

/** `2026-10-17` in the site's time zone. */
export const dateOnly = (date: Date): string => {
  const parts = dayFormatter.formatToParts(date);

  return `${partOf(parts, "year")}-${partOf(parts, "month")}-${partOf(
    parts,
    "day"
  )}`;
};

/**
 * Markdown to running text, for the excerpts the `llms` files and feeds need.
 *
 * This is not a renderer: it removes the syntax that would read as noise in a plain-text excerpt
 * (fences, links, emphasis, list and heading markers, raw HTML) and collapses whitespace.
 */
const stripMarkdown = (markdown: string): string =>
  markdown
    .replaceAll(/```[\s\S]*?```/gu, " ")
    .replaceAll(/`[^`]*`/gu, " ")
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replaceAll(/\[(?<label>[^\]]*)\]\([^)]*\)/gu, "$<label>")
    .replaceAll(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gmu, "")
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/[*_~]{1,3}/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

export const excerptOf = (text: string, maxLength: number): string => {
  const plain = stripMarkdown(text);

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trimEnd()}…`;
};
