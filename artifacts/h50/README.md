# H50：knip 收尾 + 登出后重新读取登录态

## knip

`SearchSnippetMatch`、`SearchSnippet` 只在 `orama.ts` 内部使用，去掉 `export`。`pnpm exec knip` EXIT=0。

## 登出诊断

旧实现 `router.push('/') + router.refresh()` 在 dev 与 production 实测中请求与 cookie 都正常（sign-out 200、session cookie 清空、get-session null），页头也会更新；但页头来自根布局的服务端会话，而软导航保留 App Router 的客户端缓存，`refresh()` 与 `push()` 同时发起时，根布局可能来自登出前的 RSC。用户描述的「界面不重载、仍显示已登录」与这个缓存/时序路径一致。

## 修复

- `onSuccess` 改为 `queryClient.clear(); window.location.assign('/')`：硬导航丢弃客户端缓存，服务端重新读已清空的会话 cookie。注释写明了为什么软导航不够（根布局缓存 + push/refresh 竞争）。
- `onError`：`toast.error('退出失败，请重试')`，不再静默保持已登录；pending 时禁用菜单项。

## 实测

- production build：点击 Sign out → document 导航到 `/`、页头 Sign in、session cookie 消失、`get-session` 返回 null、直接访问 `/todos` 跳 `/login?redirect=%2Ftodos`。
- 失败路径：拦截 sign-out 请求 → toast「退出失败，请重试」。
- 无登录直接 `/todos` → 307 `/login?redirect=%2Ftodos`。
- `vp check` 两文件绿、`knip` EXIT=0、e2e 7/7、web build EXIT=0。

## 备注

本机 http 测试残留了一个 `__Secure-better-auth.session_token` cookie（Secure 前缀只在 HTTPS 语义下由 Better Auth 使用），它对应的服务端会话已失效（get-session null、/todos 重定向）；HTTPS 生产环境登出会按同样的 Secure 属性清除该 cookie。
