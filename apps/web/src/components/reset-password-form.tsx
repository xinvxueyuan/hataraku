"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { Button } from "@hataraku/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";
import { Input } from "@hataraku/ui/components/input";
import { Label } from "@hataraku/ui/components/label";

import { authClient } from "#src/lib/auth-client.ts";

/** Better Auth answers a failed reset with a code; these are the ones this form can produce. */
const FAILURES = new Map<string, (minLength: number) => string>([
  ["INVALID_TOKEN", () => "这个重置链接无效或已过期。"],
  ["PASSWORD_TOO_SHORT", (minLength) => `新密码至少需要 ${minLength} 个字符。`],
  ["PASSWORD_TOO_LONG", () => "新密码过长（上限 200 个字符）。"],
]);

const readableFailure = (
  error: { code?: string; message?: string; status?: number },
  minLength: number
) => {
  if (error.status === 429) {
    return "请求过于频繁，请稍后再试。";
  }

  return (
    FAILURES.get(error.code ?? "")?.(minLength) ??
    error.message ??
    "重置失败，请稍后再试。"
  );
};

const RequestAnother = () => (
  <p className="text-muted-foreground text-sm">
    想重新申请？回到
    <Link className="underline underline-offset-4" href="/forgot-password">
      忘记密码
    </Link>
    页再发一封。
  </p>
);

/**
 * Sets a new password with the token from the email.
 *
 * The token is single use: the server consumes the verification row, so a second submission of the
 * same link answers INVALID_TOKEN. That path renders the "expired" card with a way to ask again
 * instead of a raw error.
 */
export const ResetPasswordForm = ({
  minLength,
  token,
}: {
  minLength: number;
  token: string;
}) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (error) {
        throw new Error(readableFailure(error, minLength));
      }
    },
    onSuccess: () => {
      setDone(true);
      setNewPassword("");
      setConfirmation("");
    },
  });

  const expired =
    token === "" ||
    (reset.isError && reset.error.message === "这个重置链接无效或已过期。");

  if (expired) {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>链接无法使用</CardTitle>
          <CardDescription>这个重置链接无效或已过期。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <RequestAnother />
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/login"
            >
              返回登录
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>密码已重置</CardTitle>
          <CardDescription>请用新密码登录。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm underline underline-offset-4" href="/login">
            去登录
          </Link>
        </CardContent>
      </Card>
    );
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(null);

    if (newPassword !== confirmation) {
      setProblem("两次输入的新密码不一致。");

      return;
    }

    reset.mutate();
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>设置新密码</CardTitle>
        <CardDescription>
          至少 {minLength} 位；重置后其他设备上的登录会被注销。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input
              autoComplete="new-password"
              id="new-password"
              minLength={minLength}
              onChange={(event) => {
                setNewPassword(event.target.value);
              }}
              required
              type="password"
              value={newPassword}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">再输一次新密码</Label>
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={minLength}
              onChange={(event) => {
                setConfirmation(event.target.value);
              }}
              required
              type="password"
              value={confirmation}
            />
          </div>
          <Button
            disabled={
              reset.isPending || newPassword === "" || confirmation === ""
            }
            type="submit"
          >
            {reset.isPending ? "保存中…" : "设置新密码"}
          </Button>
          {problem === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {problem}
            </p>
          )}
          {reset.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {reset.error.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
