"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@hataraku/ui/components/button";

import type { ApiTokenRecord } from "#src/components/api-token-meta.ts";
import { api } from "#src/lib/api.ts";

/** The danger action on a token's detail page; the list itself only navigates. */
export const ApiTokenRevoke = ({ token }: { token: ApiTokenRecord }) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const revoke = useMutation(
    api.apiTokens.revoke.mutationOptions({
      onSuccess: () => {
        setConfirming(false);
        router.push("/settings/api");
        router.refresh();
      },
    })
  );

  if (token.revokedAt !== null) {
    return (
      <p className="text-muted-foreground text-sm">
        这枚令牌已经吊销，不能再用于请求。
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button
        onClick={() => {
          setConfirming(true);
        }}
        type="button"
        variant="destructive"
      >
        吊销令牌
      </Button>
    );
  }

  const titleId = `revoke-token-${token.id}`;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="false"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg border p-3"
      role="alertdialog"
    >
      <p className="text-sm" id={titleId}>
        吊销「{token.name}」后它立即失效，且无法恢复。确定吗？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={revoke.isPending}
          onClick={() => {
            revoke.mutate({ id: token.id });
          }}
          size="sm"
          type="button"
          variant="destructive"
        >
          {revoke.isPending ? "吊销中…" : "确认吊销"}
        </Button>
        <Button
          onClick={() => {
            setConfirming(false);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          取消
        </Button>
      </div>
      {revoke.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {revoke.error.message}
        </p>
      ) : null}
    </div>
  );
};
