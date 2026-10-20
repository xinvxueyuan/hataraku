import type { Route } from "next";
import { redirect } from "next/navigation";

import { PASSWORD_MIN_LENGTH } from "@hataraku/auth";

import { AuthForm } from "#src/components/auth-form.tsx";
import { getSession } from "#src/server/session.ts";

const redirectTargets: Route[] = [
  "/",
  "/todos",
  "/settings/admin/posts",
  "/settings/admin/profile",
  "/settings/password",
  "/settings/security",
  "/settings/two-factor",
];

const safeRedirect = (value: string | string[] | undefined) =>
  redirectTargets.find((target) => target === value) ?? "/todos";

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
