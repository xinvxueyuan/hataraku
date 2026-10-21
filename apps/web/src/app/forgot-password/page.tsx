import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "#src/components/forgot-password-form.tsx";

export const metadata: Metadata = {
  description: "通过邮箱重置登录密码。",
  robots: { follow: false, index: false },
  title: "忘记密码",
};

const ForgotPasswordPage = () => (
  <div className="grid gap-4">
    <ForgotPasswordForm />
    <p className="text-muted-foreground text-center text-sm">
      <Link className="underline underline-offset-4" href="/login">
        返回登录
      </Link>
    </p>
  </div>
);

export default ForgotPasswordPage;
