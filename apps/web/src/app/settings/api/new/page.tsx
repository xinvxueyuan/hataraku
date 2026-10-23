import type { Metadata } from "next";

import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";
import { ApiTokenWizard } from "#src/components/api-token-wizard.tsx";

export const metadata: Metadata = {
  description: "分五步创建一枚带作用域的 API 令牌。",
  robots: { follow: false, index: false },
  title: "新建 API 令牌",
};

const readStep = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const step = raw === undefined ? 1 : Number(raw);

  return Number.isInteger(step) && step >= 1 && step <= 5 ? step : 1;
};

const NewTokenPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) => {
  const { step } = await searchParams;

  return (
    <div className="grid gap-6" data-slot="settings-page">
      <SettingsPageHeader
        description="名称、作用域、有效期分步确认，最后只显示一次明文。"
        title="新建 API 令牌"
      />
      <ApiTokenWizard initialStep={readStep(step)} />
    </div>
  );
};

export default NewTokenPage;
