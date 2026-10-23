"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@hataraku/ui/components/badge";
import { Button } from "@hataraku/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import { api } from "#src/lib/api.ts";

export interface ApiTokenRecord {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  prefix: string;
  revokedAt: Date | null;
  scopes: string[];
}

const SCOPE_LABELS = new Map<string, string>([
  ["changelog:write", "更新日志"],
  ["notes:write", "微言"],
  ["posts:write", "文章"],
  ["projects:write", "项目"],
]);

const stamp = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

const formatStamp = (value: Date | null) =>
  value === null ? "从未使用" : stamp.format(value);

type TokenStatus = "已吊销" | "已过期" | "有效";

const statusOf = (token: ApiTokenRecord): TokenStatus => {
  if (token.revokedAt !== null) {
    return "已吊销";
  }

  if (token.expiresAt !== null && token.expiresAt.getTime() <= Date.now()) {
    return "已过期";
  }

  return "有效";
};

const statusVariant = (
  status: TokenStatus
): "destructive" | "outline" | "secondary" => {
  if (status === "已吊销") {
    return "destructive";
  }

  return status === "已过期" ? "outline" : "secondary";
};

const ScopeList = ({ scopes }: { scopes: string[] }) => (
  <span className="text-muted-foreground text-xs">
    {scopes.map((scope) => SCOPE_LABELS.get(scope) ?? scope).join(" · ")}
  </span>
);

const RevokeAction = ({ token }: { token: ApiTokenRecord }) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const revoke = useMutation(
    api.apiTokens.revoke.mutationOptions({
      onSuccess: () => {
        setConfirming(false);
        router.refresh();
      },
    })
  );

  if (token.revokedAt !== null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (!confirming) {
    return (
      <Button
        aria-label={`吊销令牌 ${token.name}`}
        onClick={() => {
          setConfirming(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        吊销
      </Button>
    );
  }

  const titleId = `revoke-token-${token.id}`;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="false"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-2 rounded-lg border p-2"
      role="alertdialog"
    >
      <p className="text-xs" id={titleId}>
        吊销后立即失效，确定吗？
      </p>
      <div className="flex flex-wrap gap-1.5">
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
        <p className="text-destructive text-xs" role="alert">
          {revoke.error.message}
        </p>
      ) : null}
    </div>
  );
};

const TOKEN_COLUMNS = (
  <thead>
    <tr className="border-border text-muted-foreground border-b text-xs">
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        名称
      </th>
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        Prefix
      </th>
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        作用域
      </th>
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        创建
      </th>
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        最近使用
      </th>
      <th className="py-2 pr-3 text-left font-medium" scope="col">
        状态
      </th>
      <th className="py-2 text-left font-medium" scope="col">
        操作
      </th>
    </tr>
  </thead>
);

const TokenTable = ({ tokens }: { tokens: ApiTokenRecord[] }) => (
  <div className="hidden overflow-x-auto md:block">
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">现有 API 令牌</caption>
      {TOKEN_COLUMNS}
      <tbody>
        {tokens.map((token) => {
          const status = statusOf(token);

          return (
            <tr className="border-border border-b align-top" key={token.id}>
              <td className="py-3 pr-3 font-medium">{token.name}</td>
              <td className="py-3 pr-3 font-mono text-xs">{token.prefix}</td>
              <td className="py-3 pr-3">
                <ScopeList scopes={token.scopes} />
              </td>
              <td className="text-muted-foreground py-3 pr-3 text-xs">
                {formatStamp(token.createdAt)}
              </td>
              <td className="text-muted-foreground py-3 pr-3 text-xs">
                {formatStamp(token.lastUsedAt)}
              </td>
              <td className="py-3 pr-3">
                <Badge variant={statusVariant(status)}>{status}</Badge>
              </td>
              <td className="py-3">
                <RevokeAction token={token} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const TokenCards = ({ tokens }: { tokens: ApiTokenRecord[] }) => (
  <ul className="grid gap-3 md:hidden">
    {tokens.map((token) => {
      const status = statusOf(token);

      return (
        <li className="grid gap-2 rounded-lg border p-3" key={token.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{token.name}</p>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                {token.prefix}
              </p>
            </div>
            <Badge variant={statusVariant(status)}>{status}</Badge>
          </div>
          <ScopeList scopes={token.scopes} />
          <dl className="text-muted-foreground grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs">
            <dt>创建</dt>
            <dd>{formatStamp(token.createdAt)}</dd>
            <dt>最近使用</dt>
            <dd>{formatStamp(token.lastUsedAt)}</dd>
          </dl>
          <RevokeAction token={token} />
        </li>
      );
    })}
  </ul>
);

export const ApiTokenList = ({ tokens }: { tokens: ApiTokenRecord[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>现有令牌</CardTitle>
      <CardDescription>
        令牌只显示一次；列表里保留名称与前缀，不保存明文。
      </CardDescription>
    </CardHeader>
    <CardContent>
      {tokens.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          还没有令牌。
        </p>
      ) : (
        <>
          <TokenTable tokens={tokens} />
          <TokenCards tokens={tokens} />
        </>
      )}
    </CardContent>
  </Card>
);
