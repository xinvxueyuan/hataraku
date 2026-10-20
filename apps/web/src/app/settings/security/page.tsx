import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@hataraku/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hataraku/ui/components/card";

import { isForbidden, requireSession } from "#src/server/admin.ts";
import { serverCall } from "#src/server/query.ts";

/**
 * The security overview: the account's own sessions, the deployment's recent sign-in attempts, and
 * the two-factor state.
 *
 * The page is a view, not a boundary. `overview` filters by the session's own user id, and
 * `attempts` is an admin procedure; the page only chooses what to say when the API refuses. A
 * signed-in account outside `ADMIN_EMAILS` gets FORBIDDEN for the attempts and sees the sessions it
 * owns instead of an error page.
 */

export const metadata: Metadata = {
  description: "当前账号的活跃会话、最近的登录尝试与两步验证状态。",
  robots: { follow: false, index: false },
  title: "安全概览",
};

const stamp = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

/**
 * The outcomes the auth layer writes. An unknown value is shown as stored, so a future writer does
 * not need a page change to stay readable.
 */
const OUTCOME_LABELS = new Map<string, string>([
  ["failed", "失败"],
  ["invalid", "凭据无效"],
  ["mfa_fail", "二次验证失败"],
  ["not_allowed", "不在白名单"],
  ["password_fail", "密码错误"],
  ["pending", "进行中"],
  ["sent", "已发送"],
  ["success", "成功"],
  ["throttled", "被限流"],
  ["turnstile_fail", "人机验证失败"],
]);

const outcomeLabel = (outcome: string) =>
  OUTCOME_LABELS.get(outcome) ?? outcome;

const SecurityPage = async () => {
  const session = await requireSession("/settings/security");
  const overview = await serverCall.security.overview();

  // Deployment-wide audit data: the API owns the decision, and the page only renders the refusal.
  let attempts: Awaited<
    ReturnType<typeof serverCall.security.attempts>
  > | null = null;

  try {
    attempts = await serverCall.security.attempts();
  } catch (error) {
    if (!isForbidden(error)) {
      throw error;
    }
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">安全概览</h1>
        <p className="text-muted-foreground text-sm">
          当前账号：<span className="font-mono">{session.user.email}</span>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>活跃会话</CardTitle>
          <CardDescription>
            共 {overview.activeSessions.length}{" "}
            个未过期的会话，只包含当前账号自己的会话。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3" data-slot="session-list">
            {overview.activeSessions.map((entry) => (
              <li className="grid gap-1 rounded-lg border p-3" key={entry.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {entry.isCurrent ? "当前会话" : "会话"}
                  </span>
                  {entry.isCurrent ? (
                    <Badge variant="secondary">当前</Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {stamp.format(entry.createdAt)} 建立 ·{" "}
                  {stamp.format(entry.expiresAt)} 到期
                </p>
                <p className="text-muted-foreground text-xs break-all">
                  IP {entry.ipAddress ?? "未知"} ·{" "}
                  {entry.userAgent ?? "未知设备"}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近的登录尝试</CardTitle>
          <CardDescription>
            {attempts === null
              ? "登录尝试是部署级的审计数据，只有站长（ADMIN_EMAILS）可以查看；上面的会话列表就是当前账号自己的登录记录。"
              : "按时间倒序。数据库只保存 IP 与邮箱的 HMAC 摘要，原始地址不入库；这里显示 IP 摘要的前 12 位。"}
          </CardDescription>
        </CardHeader>
        {attempts === null ? null : (
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
                还没有记录到登录尝试。
              </p>
            ) : (
              <ul className="grid gap-2" data-slot="attempt-list">
                {attempts.map((entry) => (
                  <li
                    className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    key={entry.id}
                  >
                    <span className="font-medium">
                      {outcomeLabel(entry.outcome)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {stamp.format(entry.createdAt)}
                    </span>
                    {entry.durationMs === null ? null : (
                      <span className="text-muted-foreground text-xs">
                        {entry.durationMs} ms
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto font-mono text-xs">
                      {entry.ipDigest === null
                        ? "IP 摘要缺失"
                        : `IP 摘要 ${entry.ipDigest}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>两步验证</CardTitle>
          <CardDescription>
            {overview.twoFactorEnabled
              ? "已绑定验证器：登录时需要在密码之后输入 6 位动态码。"
              : "尚未绑定验证器：只凭密码即可登录。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={overview.twoFactorEnabled ? "default" : "outline"}>
              {overview.twoFactorEnabled ? "已开启" : "未开启"}
            </Badge>
            <Link
              className="text-sm underline underline-offset-4"
              href="/settings/two-factor"
            >
              {overview.twoFactorEnabled
                ? "管理或关闭两步验证"
                : "现在绑定验证器"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default SecurityPage;
