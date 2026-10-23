import type { Route } from "next";
import { redirect } from "next/navigation";

import { PASSWORD_MIN_LENGTH } from "@hataraku/auth";

import { AuthForm } from "#src/components/auth-form.tsx";
import { getSession } from "#src/server/session.ts";

const FALLBACK_REDIRECT = "/todos";
const ALLOWED_PREFIXES = ["/todos", "/settings"] as const;

/**
 * Accept only a same-origin path under an allowed section. The type assertion at the end is safe
 * because every returned path was checked here: single leading slash, no backslash, no dot-segment,
 * no scheme, no protocol-relative host; the URL parser is used for the final normalisation.
 */
const isAllowedRoute = (candidate: string): candidate is Route =>
  candidate === "/" ||
  ALLOWED_PREFIXES.some(
    (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`)
  );

const safeRedirect = (value: string | string[] | undefined): Route => {
  if (value === undefined || Array.isArray(value) || value === "") {
    return FALLBACK_REDIRECT;
  }

  if (
    value.trim() !== value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return FALLBACK_REDIRECT;
  }

  if (value.includes("\\")) {
    return FALLBACK_REDIRECT;
  }

  let decoded: string;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK_REDIRECT;
  }

  if (
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("..") ||
    /^[a-z][a-z0-9+.-]*:/iu.test(decoded)
  ) {
    return FALLBACK_REDIRECT;
  }

  let path: string;

  try {
    const url = new URL(value, "http://local.invalid");

    if (url.origin !== "http://local.invalid") {
      return FALLBACK_REDIRECT;
    }

    path = url.pathname;
  } catch {
    return FALLBACK_REDIRECT;
  }

  return isAllowedRoute(path) ? path : FALLBACK_REDIRECT;
};

const LoginPage = async ({ searchParams }: PageProps<"/login">) => {
  const { redirect: target } = await searchParams;
  const redirectTo = safeRedirect(target);

  if (await getSession()) {
    redirect(redirectTo);
  }

  return (
    <AuthForm minPasswordLength={PASSWORD_MIN_LENGTH} redirectTo={redirectTo} />
  );
};

export default LoginPage;
