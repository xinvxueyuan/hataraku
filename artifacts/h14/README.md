# H14 · 后台写路径 + @mdxeditor/editor

站点现在可以在线写作：`/settings/admin/posts` 是文章列表，`/settings/admin/posts/[id]`（`new` 表示新建）
是编辑页，正文用 `@mdxeditor/editor` 写 Markdown/MDX，保存与发布都走 oRPC procedure。

## 写路径（全部 `adminProcedure`）

| procedure | 作用 |
| --- | --- |
| `posts.adminList` | 全部文章（含草稿），按更新时间倒序 |
| `posts.byId` | 编辑器读一条，含 `bodyMd`，草稿也能读 |
| `posts.create` | 新建；`status` 默认 `draft` |
| `posts.update` | 局部更新（省略的字段保持原值） |
| `posts.publish` / `posts.unpublish` | 单独发布/撤回，列表页就地切换 |
| `posts.remove` | 删除，第二次返回 NOT_FOUND |

`adminProcedure` = `protectedProcedure` + 站长白名单。规则写在 `packages/api/src/procedures.ts`：
`ADMIN_EMAILS` 由 API 侧解释（`createEmailAllowlist`，来自 `@hataraku/auth`，只此一份），
**未配置 = 单用户部署，任何已登录账号都能写**（与注册的既有语义一致）；配置了则只有名单内的地址能写，
其余人拿到 `FORBIDDEN`。

## 守卫只有一份

`assertSafeMdx` 从 `apps/web/src/server/mdx-guard.ts` **移到** `packages/api/src/mdx-guard.ts`：

- 写侧：`posts.create` / `posts.update` 在入库前调用，命中则 `BAD_REQUEST`，message 带原因
  （`This body cannot be saved: process access.`），`data.reason` 也带上原因码。
- 读侧：`renderMdx` 通过 `@hataraku/api/mdx-guard` 子路径导入同一个函数（Next/Turbopack 直接吃 workspace 的 TS 源码）。
- 单测跟着规则搬到了 `packages/api/src/mdx-guard.test.ts`（10 个用例），原来的 web 副本和它的测试已删除。

`packages/api/package.json` 因此多了一个导出：`"./mdx-guard": "./src/mdx-guard.ts"`，这样 web 只拉规则、
不会把整张 router 图（drizzle/pg）带进渲染进程。

## 编辑器

- `apps/web/src/components/markdown-editor.tsx`：`MDXEditor` + 标题/列表/引用/代码块/链接/分隔线 + 快捷输入插件，
  样式表 `@mdxeditor/editor/style.css` 与组件同块懒加载。
- `apps/web/src/components/post-editor.tsx`：`next/dynamic(ssr:false)` 挂载编辑器，标题/slug/摘要/正文 + 保存、
  发布、取消发布、删除；新建成功后 `router.replace` 到 `/settings/admin/posts/<id>`，同一个表单继续编辑。
- `apps/web/src/components/admin-post-list.tsx`：列表（状态徽标、更新时间、发布/取消发布/删除）。
- 正文是纯 Markdown：编辑器不注入自定义组件属性，因此 H11 那个 `blockJS` 坑（JSX 属性表达式会被静默删掉）
  在这里不适用；被 `assertSafeMdx` 拒绝的正文在保存时就报错，而不是等到渲染。

## 证据

两项真机脚本（自带可见 Chromium，`H11_BROWSER_EXE` 可指向本机 Chrome）：

```sh
node artifacts/h14/admin-journey.mjs http://localhost:3300     # 写 → 存 → 发布 → 前台渲染
node artifacts/h14/admin-guard.mjs   http://localhost:3300     # 未登录 → 跳登录
```

`admin-journey.mjs` 在一个浏览器上下文里：注册 → 打开 `/settings/admin/posts/new` → 填标题/slug →
在编辑器里敲「正文 + `## 小标题` + 两条列表 + 工具栏插入的代码块」→ 创建草稿 → 通过 `/rpc/posts/byId`
读回存下的 markdown → 点发布 → 打开 `/posts/<slug>`。输出：

```json
{
  "checks": {
    "articleHasHeading": true,
    "articleHasList": true,
    "articleHasParagraph": true,
    "articleRenderedCode": true,
    "bodyHasCodeFence": true,
    "bodyHasHeading": true,
    "bodyHasList": true,
    "noConsoleErrors": true
  },
  "article": { "headingTwo": "小标题", "listItems": 2, "code": "console.log(\"written in the editor\");" }
}
```

存下来的 `bodyMd`（编辑器序列化的结果，纯 Markdown）：

```text
这是由后台编辑器写入的一段正文。

## 小标题

* 第一项
* 第二项

```text
console.log("written in the editor");
```
```

截图：`editor.png`（编辑页：工具栏 + 标题/列表/代码块）、`published.png`（前台文章页，代码块有高亮）、
`anonymous-redirect.png`（未登录被送到 `/login?redirect=%2Fsettings%2Fadmin%2Fposts`）。

`admin-guard.mjs` 输出：`{ editorAbsent: true, redirectedToLogin: true, redirectKeepsTarget: true }`。

### 403 那一半为什么没有页面级证据

`ADMIN_EMAILS` 同时管注册：开着白名单时，非名单地址**注册就会被拒（403）**，所以「已登录但不在名单」的账号
没法在开着白名单的部署上现造。它只可能来自「先建号、后开白名单」的历史部署——正是 `AdminForbidden` 渲染的那条路径。
这条规则由 `packages/api/tests/integration/admin-posts.test.ts` 覆盖（`FORBIDDEN`，17 个用例里专门有一条），
页面侧只是把 `FORBIDDEN` 渲染成 403 文案。

## 改动范围说明（超出任务字面写范围的三处基础设施改动）

1. `apps/server/src/orpc.ts`：把 `env.ADMIN_EMAILS` 放进 oRPC context（一行），否则 API 看不到白名单。
2. `packages/auth/src/index.ts`：导出 `createEmailAllowlist` / `parseAdminEmails`，让 API 复用同一份解析。
3. `apps/web/src/app/login/page.tsx`：`redirectTargets` 增加 `/settings/admin/posts`，登录后能回到后台。

另有 `packages/api/package.json`（新增 `./mdx-guard` 子路径导出）、`packages/api/tests/support/api.ts`
（`createClient(session, adminEmails)`）、`apps/web/package.json` + `pnpm-workspace.yaml`（`@mdxeditor/editor` 进 catalog）。

## 已知取舍

- **没有加入顶部导航**：`header.tsx` / `nav-links.tsx` 是前台交付的共享文件，避免与在途改动冲突；后台入口是
  `/settings/admin/posts`（登录后可直接访问）。要挂到导航上，只需在 `nav-links.tsx` 里加一条。
- 文章 slug 由作者手填（kebab-case 校验）：中文标题没有自动音译，宁可不猜。
- 编辑器序列化会在块之间留多余空行（`\n\n\n\n`），渲染无影响。
- 分类/标签/封面不在本次表单里（读路径字段都在，写路径先做能发文章的最小闭环）。
