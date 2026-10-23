import type { ReactNode } from "react";

import { Badge } from "@hataraku/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import type { ApiTokenRecord } from "#src/components/api-token-meta.ts";
import {
  formatStamp,
  scopeLabel,
  statusOf,
  statusVariant,
} from "#src/components/api-token-meta.ts";
import { ApiTokenRevoke } from "#src/components/api-token-revoke.tsx";
import { ApiTokenUsage } from "#src/components/api-token-usage.tsx";

const Row = ({ children, label }: { children: ReactNode; label: string }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </>
);

/** The token's own page: metadata, its curl recipes, and the destructive action. */
export const ApiTokenDetail = ({ token }: { token: ApiTokenRecord }) => {
  const status = statusOf(token);

  return (
    <div className="grid gap-6" data-slot="api-token-detail">
      <Card>
        <CardHeader>
          <CardTitle>令牌信息</CardTitle>
          <CardDescription>
            明文只在创建时出现一次，这里只展示元信息。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="名称">{token.name}</Row>
            <Row label="Prefix">
              <span className="font-mono text-xs">{token.prefix}</span>
            </Row>
            <Row label="作用域">
              {token.scopes.map((scope) => scopeLabel(scope)).join(" · ")}
            </Row>
            <Row label="创建时间">{formatStamp(token.createdAt, "—")}</Row>
            <Row label="最近使用">
              {formatStamp(token.lastUsedAt, "从未使用")}
            </Row>
            <Row label="过期时间">
              {formatStamp(token.expiresAt, "永不过期")}
            </Row>
            <Row label="状态">
              <Badge variant={statusVariant(status)}>{status}</Badge>
            </Row>
          </dl>
        </CardContent>
      </Card>

      <ApiTokenUsage />

      {token.revokedAt === null ? (
        <section className="border-destructive/40 grid gap-3 rounded-xl border p-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold">危险区</h2>
            <p className="text-muted-foreground text-sm">
              吊销不会删除记录；它只是让这枚令牌立即失效。
            </p>
          </div>
          <ApiTokenRevoke token={token} />
        </section>
      ) : null}
    </div>
  );
};
