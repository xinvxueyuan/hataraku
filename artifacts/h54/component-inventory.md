# H54 — `apps/web/src/components` 组件搬迁移判定

范围：`apps/web/src/components` 下全部 **44 个 `.tsx` 组件** + **11 个 `.ts` 支撑模块**（2 个 `.test.*` 不计）。
判定标准：`@hataraku/components` 只装**不含业务知识**、换外观/换业务域仍存在的通用组合组件；新包依赖仅 `@hataraku/ui` + `react`（不引入 next / @hataraku/{api,db,auth}）。

## 结论

| 判定 | 数量 | 组件 |
| --- | --- | --- |
| 直接搬 | 5 | docs-toc.tsx、pager.tsx、search-highlight.tsx、focus-ring.ts、use-disclosure.ts |
| 改造后可搬 | 2 | docs-admonition.tsx、docs-code-block.tsx |
| 不搬 | 48 | 其余 |

建议新包首批 API：`Pager`、`focusRing`、`useDisclosure`、`highlightMatches`（原 search-highlight）、`TableOfContents`（原 docs-toc，类型一并迁入）、`CodeBlock`/`Admonition`（图标与默认文案参数化后再搬）。

## 44 个 .tsx 组件

| 组件 | 搬 / 不搬 | 一句理由 |
| --- | --- | --- |
| `admin-forbidden.tsx` | 不搬 | 后台权限失败态，含 ADMIN_EMAILS/会话知识并依赖 next/link |
| `admin-form-parts.tsx` | 不搬 | 后台表单的失败/操作行，绑定后台流程（save/delete） |
| `admin-list-toolbar.tsx` | 不搬 | 后台列表的 GET 过滤/分页，绑定 admin 查询参数模型 |
| `admin-nav.tsx` | 不搬 | 后台路由清单，依赖 next/link + next/navigation |
| `admin-page-shell.tsx` | 不搬 | 后台页面骨架（设置导航/标题/操作），依赖 next/link |
| `admin-post-list.tsx` | 不搬 | 文章列表业务行（草稿/发布），依赖 next/link |
| `api-status-pill.tsx` | 不搬 | 服务端数据可用性探针，依赖 #src/server/query.ts |
| `auth-form.tsx` | 不搬 | Better Auth 登录/2FA 表单，依赖 next/link、next/navigation、authClient |
| `change-password-form.tsx` | 不搬 | 改密业务表单，绑定 Better Auth 错误码与账号页 |
| `changelog-editor.tsx` | 不搬 | 更新日志业务编辑器，依赖 next/dynamic、next/navigation |
| `changelog-list.tsx` | 不搬 | 更新日志列表与删除动作，依赖 next/link |
| `docs-admonition.tsx` | 改后可搬 | 通用 callout；当前直接依赖 lucide-react，而新包只允许 @hataraku/ui + react，需内联图标/由 ui 提供 |
| `docs-code-block.tsx` | 改后可搬 | 通用代码块+复制；同样依赖 lucide-react，图标需去掉或来自 ui |
| `docs-sidebar.tsx` | 不搬 | 文档目录模型（section/order/active），依赖 next/link + next/navigation |
| `docs-toc.tsx` | 搬 | 纯标题列表导航，仅依赖一个标题类型；把 TocHeading 类型移入新包即可，无 next/业务依赖 |
| `forgot-password-form.tsx` | 不搬 | 找回密码业务表单，依赖 next/link 与 auth 流程 |
| `header.tsx` | 不搬 | 站点头部外壳：品牌/导航/账号/主题，依赖 server session/admin 与 next/link |
| `image-uploader.tsx` | 不搬 | 图片上传业务（API 前缀/R2），依赖 next/image |
| `markdown-editor.tsx` | 不搬 | MDX 编辑器与上传/语言配置，绑定内容管线 |
| `media-image.tsx` | 不搬 | next/image + asset-url（R2 key→URL）业务耦合 |
| `micro-post-editor.tsx` | 不搬 | 微文编辑器业务，依赖 next/navigation |
| `micro-post-list.tsx` | 不搬 | 微文列表业务（草稿/发布），依赖 next/link |
| `mode-toggle.tsx` | 不搬 | 主题切换依赖 next-themes 与 lucide；主题策略属于应用外壳，不是纯组合组件（且违反 ui+react 依赖契约） |
| `nav-links.tsx` | 不搬 | 站点主导航与移动抽屉，依赖 next/link、next/navigation 与路由模型 |
| `pager.tsx` | 搬 | 纯前后页锚点，hrefFor/label 全由 props 注入；无 next 与业务依赖 |
| `post-cover.tsx` | 不搬 | 文章封面语义（标题首字占位）并依赖 media-image |
| `post-editor.tsx` | 不搬 | 文章编辑器业务（分类/封面/草稿），依赖 next/dynamic、next/navigation |
| `project-editor.tsx` | 不搬 | 项目编辑器业务，依赖 next/dynamic、next/navigation |
| `project-list.tsx` | 不搬 | 项目列表业务（发布状态），依赖 next/link |
| `providers.tsx` | 不搬 | 应用级 Provider 装配（QueryClient/主题/Toaster），属于 app 外壳 |
| `reset-password-form.tsx` | 不搬 | 重置密码业务表单，依赖 next/link 与 auth 错误码 |
| `search-form.tsx` | 不搬 | 搜索输入与 URL/路由同步，依赖 next/navigation |
| `search-highlight.tsx` | 搬 | 纯 React 文本切片高亮（无 next/API）；建议改名 highlightMatches 并保留 HighlightMatch 类型 |
| `sheet-canvas.tsx` | 不搬 | 未分类 |
| `sheet.tsx` | 不搬 | MDX 嵌入式表格业务（readSheetTable/Univer） |
| `site-analytics-mount.tsx` | 不搬 | 站点分析设置注入，绑定 site profile 业务 |
| `site-analytics.tsx` | 不搬 | 站点第三方分析注入，绑定 owner 配置与部署环境 |
| `site-footer.tsx` | 不搬 | 站点页脚与导航/feed 清单，依赖 next/link 与站点身份 |
| `site-profile-form.tsx` | 不搬 | 站点资料编辑业务，依赖 next/navigation |
| `todo-list.tsx` | 不搬 | Todo 示例业务与 API 客户端 |
| `turnstile-widget.tsx` | 不搬 | Turnstile 安全组件，依赖 next/script 与站点配置 |
| `two-factor-setup.tsx` | 不搬 | 2FA 设置业务，绑定 auth API 与恢复码 |
| `univer-canvas.tsx` | 不搬 | Univer 表格渲染业务（SheetRows） |
| `user-menu.tsx` | 不搬 | 账号菜单/登出业务，依赖 next/link、next/navigation 与 authClient |

## 11 个 .ts 支撑模块

| 模块 | 搬 / 不搬 | 一句理由 |
| --- | --- | --- |
| `admin-dates.ts` | 不搬 | 后台表单日期转换，绑定 admin 表单 |
| `admin-list-query.ts` | 不搬 | 后台列表 URL 参数解析 |
| `asset-url.ts` | 不搬 | R2 媒体 key→CDN URL，基础设施/业务知识 |
| `display-date.ts` | 不搬 | 硬编码 Asia/Shanghai + zh-CN 的站点日期格式；如要搬需先参数化 locale/timeZone |
| `docs-nav.ts` | 不搬 | 文档 section/order 模型 |
| `focus-ring.ts` | 搬 | 纯 class 字符串，无依赖；也可考虑由 @hataraku/ui 导出 |
| `sheet-table.ts` | 不搬 | Univer 表格单元格解析业务 |
| `site-analytics-settings.ts` | 不搬 | 直接依赖 @hataraku/db schema 的分析配置 |
| `site-content.ts` | 不搬 | 服务端站点数据读取（#src/server/query） |
| `site.ts` | 不搬 | 站点身份/环境变量/feed 格式化，业务与 next/headers |
| `use-disclosure.ts` | 搬 | 通用 details disclosure 状态 hook，无 next/业务依赖 |

## 与初判的差异

- **mode-toggle 不搬**：依赖 next-themes + lucide-react；新包只允许 @hataraku/ui + react，主题策略也应留在应用外壳。
- **display-date 不搬**：硬编码 Asia/Shanghai / zh-CN 的站点格式；要搬必须先参数化 locale/timeZone。
- **pager 可搬**：hrefFor 由 props 注入，组件本身只用 <a>，不含 next/业务知识。
- **search-highlight 可搬**：只做「文本 + 命中区间 → React 节点」，不是搜索页/路由；建议改名 highlightMatches。
- **docs-toc 可搬**：纯导航列表；把 TocHeading 类型移入新包即可，当前只依赖该类型。
- **docs-admonition / docs-code-block 改造后可搬**：当前直接依赖 lucide-react，违反新包依赖契约；需内联图标或由 @hataraku/ui 提供图标后再搬。

## 实现契约（H54 记录，供 H53/H55 遵守）

1. `packages/components/package.json` 必须自带 `private: true` 与 `license: AGPL-3.0-or-later`。
2. 依赖只有 `@hataraku/ui` + `react`；不引入 `next`、`next-themes`、`lucide-react`、`@hataraku/{api,db,auth}`。
3. 迁移组件不得保留 `#src/*` 别名导入；类型（如 TocHeading）随组件迁入或改用包内类型。

## 备注

本文件是 H54 的只读判定，等待 H53（auth）完成后再实现；不修改任何源码。

## 实施结果（H54 落地后回填）

- 新建 `packages/components`（`@hataraku/components`，private + AGPL-3.0-or-later），exports 7 个入口：`admonition`、`code-block`、`focus-ring`、`highlight`、`pager`、`table-of-contents`、`use-disclosure`。
- 依赖只有 `@hataraku/ui` + `react`（peer）与 dev 的 config/types；无 next / lucide / api/db/auth。
- `docs-admonition` / `docs-code-block` 的图标改从 `@hataraku/ui/icons` 取（Info/Lightbulb/OctagonAlert/TriangleAlert/Check/Copy），没有绕过契约。
- `search-highlight` 改名 `highlightMatches`（`highlight` 模块），全部引用点已更新；`docs-toc` → `TableOfContents`（`TocHeading` 类型随包迁入）。
- `admin-nav` / `nav-links` / `docs-sidebar` 改为从 `@hataraku/components/use-disclosure` 导入。
- 站点指纹（主题按钮、日期格式、分页文案/href、焦点环 computed box-shadow、TOC 锚点、四容器、复制反馈）：迁移前后 JSON **完全相等**。
- 全仓 `vp check` 220 files 0 errors；web build EXIT=0；e2e 7/7；knip EXIT=0。
