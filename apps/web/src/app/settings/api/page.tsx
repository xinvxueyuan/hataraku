import Link from "next/link";

import { Button } from "@hataraku/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { ApiTokenList } from "#src/components/api-token-list.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/api";

const NewTokenButton = () => (
  <Button render={<Link href="/settings/api/new" />}>新建令牌</Button>
);

const EmptyTokens = () => (
  <Card data-slot="api-token-empty">
    <CardHeader>
      <CardTitle>还没有令牌</CardTitle>
      <CardDescription>
        创建一枚带作用域的令牌，就可以从外部写入文章、微言、项目或更新日志。
      </CardDescription>
    </CardHeader>
    <CardContent>
      <NewTokenButton />
    </CardContent>
  </Card>
);

/**
 * The token chooser. Creation and usage live on their own pages: this page answers "which token?"
 * and nothing else.
 */
const ApiSettingsPage = async () => {
  await requireSession(PATH);

  let tokens: Awaited<ReturnType<typeof serverCall.apiTokens.list>> | null =
    null;

  try {
    tokens = await serverCall.apiTokens.list();
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }
  }

  if (tokens === null) {
    return <AdminForbidden />;
  }

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        action={tokens.length === 0 ? undefined : <NewTokenButton />}
        description="选择一枚令牌查看详情，或创建一枚新的写入令牌。"
        title="API 令牌"
      />
      {tokens.length === 0 ? <EmptyTokens /> : <ApiTokenList tokens={tokens} />}
    </div>
  );
};

export default ApiSettingsPage;
