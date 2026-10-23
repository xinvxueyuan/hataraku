import type { Metadata } from "next";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { AdminPageShell } from "#src/components/admin-page-shell.tsx";
import { ApiTokenCreate } from "#src/components/api-token-create.tsx";
import { ApiTokenList } from "#src/components/api-token-list.tsx";
import { ApiTokenUsage } from "#src/components/api-token-usage.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

const PATH = "/settings/api";

export const metadata: Metadata = {
  description: "为外部请求创建带作用域的 API 令牌。",
  robots: { follow: false, index: false },
  title: "API 令牌",
};

/**
 * Token management for the owner. The token plaintext exists only in the create response, so this
 * page keeps the list and the create form separate: the list reads names and prefixes, while the
 * form holds the one-time value in client state until the owner dismisses it.
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
    <AdminPageShell
      current={PATH}
      description="创建和管理用于外部写作请求的令牌；令牌只显示一次，作用域只有四个写入范围。"
      title="API 令牌"
    >
      <ApiTokenList tokens={tokens} />
      <ApiTokenCreate />
      <ApiTokenUsage />
    </AdminPageShell>
  );
};

export default ApiSettingsPage;
