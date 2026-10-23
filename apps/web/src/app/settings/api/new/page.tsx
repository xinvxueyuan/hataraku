import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import { SettingsPageHeader } from "#src/components/admin-page-shell.tsx";

/**
 * H81 replaces this landing with the five-step creation flow. Keeping the route resolvable now means
 * the list's primary action never leads to a 404 while that flow is in progress.
 */
const NewTokenPage = () => (
  <div className="grid gap-6" data-slot="settings-page">
    <SettingsPageHeader
      description="新建令牌的步骤向导正在下一步接入。"
      title="新建令牌"
    />
    <Card>
      <CardHeader>
        <CardTitle>向导即将提供</CardTitle>
        <CardDescription>
          名称、作用域、有效期与复核会在独立步骤中完成，明文只在最后一步显示一次。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          className="text-sm underline underline-offset-4"
          href="/settings/api"
        >
          返回令牌列表
        </Link>
      </CardContent>
    </Card>
  </div>
);

export default NewTokenPage;
