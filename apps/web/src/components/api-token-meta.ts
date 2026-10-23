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
  ["posts:write", "写作"],
  ["projects:write", "项目"],
]);

const stamp = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export const formatStamp = (value: Date | null, fallback: string) =>
  value === null ? fallback : stamp.format(value);

export type TokenStatus = "已吊销" | "已过期" | "有效";

export const statusOf = (token: ApiTokenRecord): TokenStatus => {
  if (token.revokedAt !== null) {
    return "已吊销";
  }

  if (token.expiresAt !== null && token.expiresAt.getTime() <= Date.now()) {
    return "已过期";
  }

  return "有效";
};

export const statusVariant = (
  status: TokenStatus
): "destructive" | "outline" | "secondary" => {
  if (status === "已吊销") {
    return "destructive";
  }

  return status === "已过期" ? "outline" : "secondary";
};

export const scopeLabel = (scope: string) => SCOPE_LABELS.get(scope) ?? scope;

export const scopeLabels = (scopes: string[]) =>
  scopes.map((scope) => scopeLabel(scope)).join(" · ");
