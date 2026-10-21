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

/**
 * The one answer this page gives, whether or not the address is registered: the endpoint answers
 * the same way for both cases, and repeating its wording keeps the page from becoming the oracle the
 * endpoint refuses to be.
 */
const SENT_MESSAGE = "如果该地址已注册，我们已发送重置邮件。";

/**
 * A failure the reader can act on. Throttling and an unconfigured deployment are not "no such
 * address", so they are said plainly; everything else keeps the endpoint's message.
 */
const readableFailure = (error: {
  code?: string;
  message?: string;
  status?: number;
}) => {
  if (error.status === 429) {
    return "请求过于频繁，请稍后再试。";
  }

  if (error.code === "RESET_PASSWORD_DISABLED") {
    return "本站暂未开启密码重置。";
  }

  if (error.status !== undefined && error.status >= 500) {
    return "邮件服务暂时不可用，请稍后再试。";
  }

  return error.message ?? "发送失败，请稍后再试。";
};

/** Asks for a reset link. The reply is deliberately the same for every address. */
export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = useMutation({
    mutationFn: async (address: string) => {
      const { error } = await authClient.requestPasswordReset({
        email: address,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(readableFailure(error));
      }
    },
    onSuccess: () => {
      setSent(true);
    },
  });

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(false);
    request.mutate(email.trim());
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>忘记密码</CardTitle>
        <CardDescription>
          输入注册时使用的邮箱，我们会发一封带重置链接的邮件。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="grid gap-3">
            <output className="text-sm">{SENT_MESSAGE}</output>
            <p className="text-muted-foreground text-sm">
              没收到？检查垃圾邮件，或
              <Link
                className="underline underline-offset-4"
                href="/forgot-password"
              >
                再试一次
              </Link>
              。
            </p>
            <Link
              className="text-muted-foreground text-sm underline underline-offset-4"
              href="/login"
            >
              返回登录
            </Link>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="reset-email">邮箱</Label>
              <Input
                autoComplete="email"
                id="reset-email"
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
                type="email"
                value={email}
              />
            </div>
            <Button
              disabled={request.isPending || email.trim() === ""}
              type="submit"
            >
              {request.isPending ? "发送中…" : "发送重置邮件"}
            </Button>
            {request.isError ? (
              <p className="text-destructive text-sm" role="alert">
                {request.error.message}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
};
