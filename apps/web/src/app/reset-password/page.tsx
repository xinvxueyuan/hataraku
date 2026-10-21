import type { Metadata } from "next";
import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@hataraku/auth";

import { ResetPasswordForm } from "#src/components/reset-password-form.tsx";

export const metadata: Metadata = {
  description: "用邮件里的链接设置新的登录密码。",
  robots: { follow: false, index: false },
  title: "重置密码",
};

/**
 * The landing page of the reset link.
 *
 * Better Auth's callback endpoint validates the token first and redirects here with either
 * `?token=…` or `?error=INVALID_TOKEN`; a missing token is the same "cannot use this link" state,
 * so the form always renders one of the two cards.
 */

/** A query string can repeat a key, so an unparsable query is simply "no usable link". */
const LINK_SCHEMA = z.object({
  error: z.string().optional(),
  token: z.string().optional(),
});

const ResetPasswordPage = async ({
  searchParams,
}: PageProps<"/reset-password">) => {
  const parsed = LINK_SCHEMA.safeParse(await searchParams);
  const error = parsed.success ? parsed.data.error : undefined;
  const token = parsed.success ? parsed.data.token : undefined;

  return (
    <ResetPasswordForm
      minLength={PASSWORD_MIN_LENGTH}
      token={error === undefined ? (token ?? "") : ""}
    />
  );
};

export default ResetPasswordPage;
