# H80：settings SPA 基础与 API 令牌列表/详情

## 结构

- `app/settings/layout.tsx` 只渲染一次 shell（侧栏 + 内容列）；`SettingsSidebar` 依据 pathname 高亮；
- `app/settings/api/loading.tsx` 提供导航骨架；API 段 `layout.tsx` 在 loading 边界前做 requireSession，保证未登录 307；
- `/settings/api` 只做选择：标题、新建令牌、令牌表格；吊销和 curl 用法迁到详情；
- `/settings/api/[id]`：元信息、该令牌的两条 curl、危险区吊销（alertdialog）；不存在 id 调 notFound()；
- `/settings/api/new` 暂为 H81 向导占位，直达 200。

## 验证

SPA 探针 `window.__spa=1`、loading 截图、列表/空态/详情 1440+390、390 无溢出、未登录 307、ready/design/compat/knip/e2e 见 `evidence.txt`。
