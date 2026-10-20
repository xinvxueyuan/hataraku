# H32 · 后台列表可运维性 + `/settings/admin` 入口页

H22 对账的 P2，加一个更基础的问题：`/settings/admin` 本身是 404 —— 进后台得记住具体子路径。

## `/settings/admin` 入口页

总览把全部后台入口列成卡片：每项一句用途 + 当前数量（文章总数与草稿数来自一次 `count(*) filter`，
微言/项目/更新日志的数量来自各自 `adminList({ pageSize: 1 }).total`，与打开那一页时看到的数字同源）。

| 入口 | 说明 |
| --- | --- |
| 文章 / 微言 / 项目 / 更新日志 | 四个内容面，带数量 |
| 站点 | `/settings/admin/profile` |
| 安全 / 密码 / 两步验证 | 账号类页面（auth 的 H29/H31 交付） |

未登录 → `requireSession` 跳登录；不在白名单 → 既有的 403 块。
（`/settings/admin` 还没进 login 的 `redirectTargets`，所以入口页用 `/settings/admin/posts` 作为登录后的落地值；
那个文件在 auth 的写范围里，本轮没动，等下一轮加一行即可。）

## 四个列表：搜索 / 筛选 / 排序 / 分页

全部**服务端**完成，SQL 里 `where` + `limit` + `offset`，不把整表拉到浏览器：

| 列表 | 搜索范围 | 筛选 | 排序 |
| --- | --- | --- | --- |
| 文章 | 标题 / slug / 正文 | 状态（草稿、已发布） | 更新时间倒序（默认）、发布时间倒序 |
| 微言 | 正文 / slug | 类型（6 种）、可见性 | 发布时间倒序（默认）、创建时间倒序 |
| 项目 | 标题 / slug / 简介 / 正文 | 状态（4 种）、可见性 | 更新时间倒序（默认）、发布时间倒序 |
| 更新日志 | 版本 / slug / 标题 / 正文 | 重点版本 | 发布时间倒序（默认）、创建时间倒序 |

**URL 就是状态**：`?q=&status=&sort=&page=` 由页面解析 → 交给 procedure → 每个链接都带着它，所以
筛选后翻页仍保留筛选，把 URL 粘到新标签页得到同一视图（真机里验证了这一点）。

**非法输入的行为明确写在两个地方**：

- **API**：`page < 1`、`pageSize < 1` 或 `> 50` 一律 `BAD_REQUEST`（zod 边界），不静默夹到合法范围 ——
  分享出去的 `page=0` 是坏链接，静默显示第 1 页会把 bug 藏起来。集成测试逐项断言了这一点。
- **页面**：URL 里的 `page` 不是正整数时按 1 处理，`status`/`sort` 不在枚举内时回落到默认值 ——
  手写或粘错的链接应当仍然渲染，而不是 500。

组件分工：`admin-list-toolbar.tsx` 是**纯 GET 表单 + 分页链接**（无客户端 JS，提交即换 URL），
`admin-list-query.ts` 负责解析/拼装（`readAdminQuery` / `readAdminPage` / `readAdminChoice` / `readAdminFilter` /
`readAdminBoolean` / `adminListHref`）。列表本身仍是客户端组件（因为要跑发布/删除 mutation），
但筛选与分页都不需要它参与。

## 真机验证

```sh
node artifacts/h32/admin-lists-journey.mjs http://localhost:3302
```

跑在 `next build` + `next start` 的生产产物上，exit 0，**16 项断言全 true**：

| 断言 | 证明了什么 |
| --- | --- |
| `indexListsEverySurface` / `indexShowsLiveCount` | 入口页列出 8 个入口并显示真实数量 |
| `firstPageHasTenRows` / `unfilteredTotalIsShown` | 分页生效（12 条数据第一页 10 条） |
| `searchNarrowsToTwelve` / `searchNarrowsToOne` | 搜索在服务端命中（12 → 1） |
| `filterKeepsOnlyPublished` / `filterSelectionIsRendered` | 状态筛选只剩 4 条，且下拉框回显所选值 |
| `pagerKeepsFilter` / `secondPageHasRest` / `secondPageKeepsFilterInput` | 翻页链接带筛选，第二页 2 条且搜索框仍是原词 |
| `pastedUrlReproducesView` | 新标签页直接粘 URL 复现同一视图 |
| `microFiltersByType` / `projectsFilterByStatus` / `changelogFiltersToHighlights` | 三个内容列表各自的枚举筛选 |
| `noConsoleErrors` | 全程 0 控制台错误 |

数据（12 篇文章 + 2 微言 + 2 项目 + 2 更新日志）通过 RPC 造、结束时全部删除；核库后
`posts 39 / micro 0 / projects 2 / changelog 0`，`h32-*` 残留 0、孤儿关联 0。
截图：`index.png`、`posts-search.png`、`posts-page-2.png`、`micro-filtered.png`。

## 测试

`admin-posts.test.ts` 25 → **31 例**、`admin-content.test.ts` 20 → **24 例**，新增：

- 分页：造 3 条数据、`pageSize: 2` 分两页（2 + 1），`total`/`totalPages` 稳定，第二页与第一页无重复；
- 搜索命中标题、slug、正文三个位置；
- 文章按状态筛选；微言按类型与可见性；项目按状态与可见性；更新日志按重点标记；
- **非法 page/pageSize 被拒绝**（posts 与三个内容列表各断言一次 `BAD_REQUEST`）；
- 排序：`sort=published` 按发布日期倒序；
- `adminStats` 的 `total = drafts + published`。

## 已知取舍

- `pageSize` 固定 10（URL 里没有 `size`）：后台列表的密度不需要用户调；API 层仍是可传的（上限 50），
  且非法值会被拒绝，这一点由集成测试兜底。
- 搜索结果不做高亮、不分词：`ILIKE '%term%'`，够后台用；真正的全文检索在 `search_index` 那条链路上，
  不在本次范围。
- 计数与列表各查一次（`total` 需要单独 `count(*)`），两者在同一个请求里先后执行，页面不会自相矛盾。
