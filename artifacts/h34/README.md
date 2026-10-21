# H34：把后台与设置入口放进用户菜单

## 根因与改动

`user-menu.tsx` 原来只有「Two-factor authentication」和「Sign out」，`/settings/**` 与 `/settings/admin` 全部只能手输 URL。

| 文件 | 改动 |
| --- | --- |
| `components/user-menu.tsx` | 新增 `isAdmin` prop；菜单分三组：邮箱 →「写作后台」（仅站长，含「后台管理」）→「账号设置」（修改密码 / 安全设置 / 两步验证）→ Sign out；用 `DropdownMenuLabel`/`DropdownMenuSeparator` 分隔 |
| `components/header.tsx` | 服务端会话求出 `isAdmin` 后传入 `UserMenu` |
| `server/admin.ts` | 新增 `isSiteOwner(email)`：复用 `createEmailAllowlist`，与 `adminProcedure` 同一语义 |

## 站长判定（服务端）

```ts
const allowlist = createEmailAllowlist(readEnv().ADMIN_EMAILS);
return allowlist === undefined || allowlist(email);
```

- `ADMIN_EMAILS` 未设置或为空 → 单用户部署（与注册、写入 procedure 同一读法），任何已登录账号即站长，菜单显示「后台管理」。
- 设置后 → 只有白名单地址是站长；白名单不会下发到浏览器（菜单只拿到布尔值）。
- 隐藏入口只是 UX：`/settings/admin` 的页面与写接口仍按 API 的 admin 判定拒绝非白名单账号（实测 403）。

## 冻结 e2e 契约

触发按钮的可访问名仍是 `user.name`；`Sign out` 仍是 `menuitem` 且文案未改。新增项只追加 menuitem，不改变这两者。
`E2E_TEST_PORT=3210 pnpm exec e2e run` → **7/7 passed**（3200 被另一个 e2e 栈占用，未杀，改用备用端口）。

## 实测

- 未配置白名单：Owner 菜单 = [后台管理, 修改密码, 安全设置, 两步验证, Sign out]；点击「后台管理」→ `/settings/admin`，`data-slot="admin-index"` 8 项，无 403。
- 配置 `ADMIN_EMAILS=owner@test.local`：Guest Two（白名单外、会话在白名单生效前建立）菜单无「后台管理」；直接访问 `/settings/admin` → 403「没有写作权限」。
- 移动端 390：两种账号菜单均可打开，菜单盒在视口内；Guest 点「两步验证」→ `/settings/two-factor`。
- 截图 5 张：`h34-menu-admin-desktop.png`、`h34-menu-guest-desktop.png`、`h34-menu-admin-mobile.png`、`h34-menu-guest-mobile.png`、`h34-admin-index.png`。

## 门禁

- `vp check`（含 fmt）：3 个改动文件 0 error。
- `pnpm run ready`：**EXIT=0**（`evidence-ready.txt`）。默认 e2e 端口 3200 被另一个 e2e 栈占用（未杀他人进程），本次用 `E2E_TEST_PORT=3210` 跑完整门禁；同一套 7 个 e2e 全过。

## 备注

- 本地 3000 被其他任务的 `next start` 占用，实测用 3010（未杀他人进程）；结束后已停止。
- 测试账号（owner@test.local / guest2@test.local）留在本地开发库，未动生产数据。