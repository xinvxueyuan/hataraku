import Link from "next/link";

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
  scopeLabels,
  statusOf,
  statusVariant,
} from "#src/components/api-token-meta.ts";

const DetailLink = ({ token }: { token: ApiTokenRecord }) => (
  <Link
    className="text-sm whitespace-nowrap underline-offset-4 hover:underline"
    href={`/settings/api/${token.id}`}
  >
    查看详情 →
  </Link>
);

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
              <td className="py-3 pr-3">
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  href={`/settings/api/${token.id}`}
                >
                  {token.name}
                </Link>
              </td>
              <td className="py-3 pr-3 font-mono text-xs">{token.prefix}</td>
              <td className="text-muted-foreground py-3 pr-3 text-xs">
                {scopeLabels(token.scopes)}
              </td>
              <td className="text-muted-foreground py-3 pr-3 text-xs">
                {formatStamp(token.createdAt, "—")}
              </td>
              <td className="text-muted-foreground py-3 pr-3 text-xs">
                {formatStamp(token.lastUsedAt, "从未使用")}
              </td>
              <td className="py-3 pr-3">
                <Badge variant={statusVariant(status)}>{status}</Badge>
              </td>
              <td className="py-3">
                <DetailLink token={token} />
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
              <Link
                className="block truncate font-medium hover:underline"
                href={`/settings/api/${token.id}`}
              >
                {token.name}
              </Link>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                {token.prefix}
              </p>
            </div>
            <Badge variant={statusVariant(status)}>{status}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">
            {scopeLabels(token.scopes)}
          </p>
          <dl className="text-muted-foreground grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs">
            <dt>创建</dt>
            <dd>{formatStamp(token.createdAt, "—")}</dd>
            <dt>最近使用</dt>
            <dd>{formatStamp(token.lastUsedAt, "从未使用")}</dd>
          </dl>
          <DetailLink token={token} />
        </li>
      );
    })}
  </ul>
);

export const ApiTokenList = ({ tokens }: { tokens: ApiTokenRecord[] }) => (
  <Card data-slot="api-token-list">
    <CardHeader>
      <CardTitle>现有令牌</CardTitle>
      <CardDescription>
        选择一枚令牌查看元信息、用法与吊销操作。
      </CardDescription>
    </CardHeader>
    <CardContent>
      <TokenTable tokens={tokens} />
      <TokenCards tokens={tokens} />
    </CardContent>
  </Card>
);
