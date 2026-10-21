# H63：路由从零（写作降级为 /blog，文档同级）

## 最终路由

- `/blog`（原 `/article`）、`/blog/[slug]`（原 `/posts/[slug]`）
- `/blog/archive`、`/blog/taxonomy`、`/blog/taxonomy/[type]/[slug]`
- `/notes`（原 `/micro`，文案「微言」）
- `/docs`、`/docs/[slug]` 进入主导航，与写作同层

旧 `/article`、`/article/[slug]`、`/posts/*`、`/archive`、`/taxonomy`、`/micro` 全部删除，**不设重定向**；实测 404。

## 导航

`首页 写作 文档 项目 相册 更多(微言 更新日志 工具箱 归档 分类) 关于 搜索`；`BAR_BREAK=5`，`/docs` 首次进入主栏；移动端平铺全部 12 项，抽屉复用 `useDisclosure`（外部点击 / Escape / 链接 / 路由四条关闭路径实测）。

## 引用更新

首页、关于、相册、项目、搜索、页脚、nav、RSS/Atom、sitemap、llms/llms-full、OG/后台编辑器提示、API 测试夹具均改为新路径；`/api/posts/*` 是 API 契约，保持不动。

## 封面收敛

按 lead 追加要求，web 侧只使用 `coverKey`：删除 `coverSrc`、`post.cover`、`album.cover`、`project.cover` 读取；sitemap 用 `assetUrl(coverKey)`，无 key 不输出 images。

## 验证

见 `evidence.txt` 与 `nav.json` / `nav-mobile.json`；截图 `final-*`。门禁：check:compat 0、check:design 0、scoped vp check 0、knip 0、e2e 7/7、build EXIT=0。
