# H23 给新页面加站内入口（主导航 + 页脚）

## 方案与理由

**桌面端：一级 8 项 + 「更多」分组下拉。** 一级保留 首页 / 文章 / 微文 / 项目 / 更新日志 / 关于 / 搜索，「更多」收纳 归档 / 分类 / 相册 / 工具箱：

- 加入四个新页面后如果全部平铺是 11 项，在 1024px 以下的 md 区间必然换行或挤压；分组后一级仍是 8 项，1280 / 1024 / 900 三个宽度实测都是单行、无重叠、无横向滚动。
- 四个新页面是本次迁移新增的内容入口，放在一级才能被找到；归档/分类/相册/工具箱是目录型浏览，收进「更多」与它们的从属关系一致。
- 保留 关于 在一级：它当前就在一级，收进去属于无关的导航降级。

**移动端：** `<details>/<summary>` 折叠面板平铺全部 11 项（嵌套下拉在移动上更难用）。

## 交互与可访问性

- `aria-current="page"` 由 pathname 推导，桌面 bar 与移动菜单共用同一份链接表；/posts/* 与 /article 都命中「文章」，/micro、/projects、/toolbox、/changelog 各自命中。
- 键盘：summary 是原生 `<details>` 触发器，Enter/Space 可展开；展开后焦点自动进入面板首项；Escape 关闭并把焦点还给 summary（原生 details 不提供，已补）。点击面板内链接后面板自动收起。
- 每个可聚焦元素都有 `focus-visible:ring-2` 焦点环；面板用绝对定位，不参与文档流，不影响布局。
- 「更多」与「菜单」的 summary 文本始终可见，不依赖 hover。

## 改动文件

- `apps/web/src/components/nav-links.tsx`：链接表、桌面「更多」、移动 `MobileNav`、焦点/Esc/点击收起逻辑
- `apps/web/src/components/header.tsx`：桌面用 `NavLinks`，窄屏改用 `MobileNav`
- `apps/web/src/components/site-footer.tsx`：页脚新增四个入口
- `artifacts/h23/**`：本文件、浏览器证据、构建日志、截图

## 验证

- 1280 / 390 两个宽度：`scrollWidth === clientWidth`（无横向滚动），一级导航单行、链接两两无重叠；截图 `screenshots/h23-desktop-1280.png`（「更多」展开）、`screenshots/h23-mobile-390.png`（菜单展开）。
- 键盘：桌面 Tab 到「更多」→ Enter 展开、焦点进入「归档」→ Esc 关闭、焦点回到 summary；移动 Tab 到「菜单」→ Enter 展开、焦点进入「首页」→ Tab ×2 到「微文」→ Enter 落地 /micro（200）→ Esc 关闭。
- 12 条路径的 `aria-current` 逐页断言（见 `evidence-browser.txt`）。
- 中间宽度抽查：1280 / 1024 / 900 均单行无重叠；767px 以下桌面导航隐藏、移动菜单可用（md 断点）。
- `vp check --no-fmt apps/web/src/components/{nav-links.tsx,header.tsx,site-footer.tsx}`：0 error。
- `pnpm --filter @hataraku/web build`：通过（`evidence-build.txt`）。

## 备注

- 未改动 `apps/web/src/app/{micro,projects,toolbox,changelog}/**` 与 `/settings/**`。
- 本地 3300 被另一个任务的 preview server 占用，本次实测使用 3302（未杀他人进程）。
