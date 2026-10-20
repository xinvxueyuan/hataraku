"use client";

import { useMutation } from "@tanstack/react-query";
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

/**
 * Turns Better Auth's error code into a sentence. These are the codes `/change-password` can
 * produce for this form; anything else keeps the API's own message rather than hiding a real fault.
 */
const FAILURES = new Map<string, (minLength: number) => string>([
  ["INVALID_PASSWORD", () => "当前密码不正确。"],
  ["PASSWORD_TOO_SHORT", (minLength) => `新密码至少需要 ${minLength} 个字符。`],
  ["PASSWORD_TOO_LONG", () => "新密码过长（上限 200 个字符）。"],
  [
    "CREDENTIAL_ACCOUNT_NOT_FOUND",
    () => "这个账号没有密码（可能是第三方登录创建的），无法在这里修改。",
  ],
]);

const readableFailure = (
  error: { code?: string; message?: string },
  minLength: number
) =>
  FAILURES.get(error.code ?? "")?.(minLength) ??
  error.message ??
  "修改密码失败，请稍后再试。";

export const ChangePasswordForm = ({ minLength }: { minLength: number }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const change = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        // The old password may be known to someone else; a change is the moment to end their sessions.
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(readableFailure(error, minLength));
      }
    },
    onSuccess: () => {
      setChanged(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
    },
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProblem(null);
    setChanged(false);

    if (newPassword !== confirmation) {
      setProblem("两次输入的新密码不一致。");

      return;
    }

    change.mutate();
  };

  const empty =
    currentPassword === "" || newPassword === "" || confirmation === "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
        <CardDescription>
          输入当前密码，再设置新密码。新密码至少 {minLength}{" "}
          位；保存后其他设备上的登录会被注销。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="current-password">当前密码</Label>
            <Input
              autoComplete="current-password"
              id="current-password"
              onChange={(event) => {
                setCurrentPassword(event.target.value);
              }}
              required
              type="password"
              value={currentPassword}
            />
          </div>
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
          <Button disabled={change.isPending || empty} type="submit">
            {change.isPending ? "保存中…" : "更新密码"}
          </Button>
          {problem === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {problem}
            </p>
          )}
          {change.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {change.error.message}
            </p>
          ) : null}
          {changed ? (
            <output className="text-sm font-medium">
              密码已更新。下次登录请使用新密码。
            </output>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
