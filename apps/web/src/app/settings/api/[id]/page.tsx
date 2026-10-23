import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminForbidden } from "#src/components/admin-forbidden.tsx";
import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { ApiTokenDetail } from "#src/components/api-token-detail.tsx";
import { isForbidden, requireSession } from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

export const metadata: Metadata = {
  description: "查看一枚 API 令牌的元信息、用法与吊销操作。",
  robots: { follow: false, index: false },
  title: "API 令牌详情",
};

/**
 * One token's page. The list procedure is the only read available for a token, so the page finds
 * its row there; an id that is not in the list is genuinely absent, not a permission error.
 */
const ApiTokenDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  await requireSession("/settings/api");

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

  const token = tokens.find((entry) => entry.id === id);

  if (token === undefined) {
    notFound();
  }

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        description={`${token.name} · ${token.prefix}`}
        title="令牌详情"
      />
      <ApiTokenDetail token={token} />
    </div>
  );
};

export default ApiTokenDetailPage;
