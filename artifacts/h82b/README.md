# H82b：settings 去壳

## 改动

- 11 个 settings 页面移除 AdminPageShell 包裹（admin/posts/projects/micro/changelog/profile、对应 [id]/new、password/security/two-factor）；admin/page 与 posts/[id] 之前已迁移；
- `AdminPageShell` 组件删除，只保留 `SettingsPageHeader` 与 `AdminBackLink`；
- 新增 `app/settings/loading.tsx`（侧栏 + 内容骨架）；
- 新增 `proxy.ts` 把 pathname 传给 settings layout，使未登录请求在 loading 边界前 307，并保留各页 requireSession/isForbidden。

## 验证

SPA flag=1、12 路由 200、未登录 307（正确 redirect）、迁移前后截图逐字节相同、390 无溢出、ready/design/compat/knip/e2e 见 `evidence.txt`。
