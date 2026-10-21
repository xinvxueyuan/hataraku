# H38 设计审查修复

审查基线：`artifacts/h38-design-review/README.md`。逐条对应如下。

## P0

**1. 移动端卡片挤压** — `PostCover` 在首页、`/article`、`/taxonomy/[type]/[slug]` 的列表卡片上改为 `hidden sm:block`：窄屏不占 120px，正文列拿到整行；`sm` 以上保持原缩略图。详情页封面不受影响。
证据：390px 首页 2587→2035px（−552，−21%），文章列表 3237→2148px（−1089，−34%）；截图 `before/after-home-390.png`、`before/after-article-390.png`。

**2. 占位字形无意义** — `initialOf` 改用 `/\p{L}/u`（首个字母或汉字），数字与标点跳过，取不到时回落到站点标记「夜」。38 篇已发布标题逐条验证 38/38 通过；列表 DOM 实测 `["一","年","一","深","N","C","M","W","L","J"]`。
证据：`evidence.txt`「占位字形」段。

**3. API 胶囊在公开正文流** — 从首页 header 移除，移到页脚 colophon 行；正文流不再出现。**保留 Connected 文案**：冻结 e2e（`home page reports the API as connected`）断言 `getByText("Connected")` 可见，任务同时要求 e2e 7/7，所以选择「移到页脚」而不是「只在离线时显示」——这是与冻结规格兼容的解法。
证据：首页 HTML 无正文胶囊、footer 有 `data-slot="api-status"`；e2e 7/7（含该用例）。

**4. 页脚泄漏实现** — 「内容与装备数据来自 Postgres」→「把代码、学习与生活写成可读的记录」。读者视角，不再提数据库；「装备」一词移除。
证据：首页 HTML 不含 Postgres/装备；截图 after-home-*。

**5. 后台卡片两种信息混排** — 只有内容类保留数量 chip（文章/微言/项目/更新日志），账号类（站点/安全/密码/两步验证）的类别词删除（`count: null`，不渲染右侧 span）。同一列现在只承载数量。
证据：`/settings/admin` 8 卡片 / 4 chip；截图 `after-admin-1440.png`。

## P1

**6. 文章列表同构** — 第一条（最新）标题 `text-2xl font-semibold`、封面 `sm:w-56`（其余 `sm:w-40`），`sizes` 同步调整，给眼睛落点。
证据：`after-article-1440.png`。

**7. 分页无禁用态** — `Pager` 的不可用方向改为 `aria-disabled="true"` + `opacity-50` + `cursor-not-allowed`；`/article` 的内联分页同样处理。
证据：DOM 实测 `[aria-disabled=true]` 上一页 opacity 0.5。

**8. 标签孤儿换行** — 文章列表标签行改 `flex-nowrap overflow-hidden`，只显示前 3 个并追加 `+N`，日期 `shrink-0`；不再出现单独一行的标签。
证据：`after-article-*.png`。

**9. 后台副标题对开发者说话** — 改为「写作、站点资料与账号设置，全部入口都在这里。」

**10. 后台出现路由 `/micro`** — 微言描述改为「短句与碎片，纯文本，读者在「微文」里看到。」

**11. 微动态空态 500px 空白** — 空态包进 `min-h-[45vh]` 的居中容器，空白被空态吸收；实测容器 380px（844 视口）。
证据：`after-micro-1440.png` / `after-micro-390.png`。

**12. 移动端头部三控件挤品牌** — 用户菜单触发器在 `sm` 以下只显示 `UserRound` 图标，名字仍在 `sr-only` 文本里（可访问名不变，冻结 e2e 的 `button "Ada"` 不受影响）；桌面恢复文字。品牌加 `shrink-0`，控件间距 `gap-1.5 sm:gap-2`。
证据：390 实测品牌宽 59px；按钮可访问名 Owner；截图 `after-header-390.png`。

## P2

**13. 占位字符缺 aria-hidden** — 占位 span 一直有 `aria-hidden="true"`；本次 DOM 复核 10/10 均为 true。

**14. 胶囊 12px** — 改为 `text-sm`（14px）+ 状态 `font-medium`（仓库 lint 禁止 13px 的 arbitrary 值，最近 token 为 14px）。

## 验证

- 对比度复测与审查基线一致：暗 17.2 / 7.2 / 7.2；亮 17.3 / 5.86 / 5.86（均 ≥ 4.5）。
- e2e：`E2E_TEST_PORT=3210 pnpm exec e2e run` → 7/7（3200 被其他栈占用时用备用端口）；随后默认端口空出，`pnpm run ready` 的 e2e 也在默认 3200 通过。
- 门禁：`vp check`（含 fmt）11 个改动文件 0 error；`pnpm run ready` **EXIT=0**（`evidence-ready.txt`）。
- 截图：`artifacts/h38-fix/`（before/after home+article 两宽、after header/micro/admin）。

## 改动文件

- `components/{post-cover,api-status-pill,site-footer,pager,user-menu,header}.tsx`
- `app/{page.tsx,article/page.tsx,taxonomy/[type]/[slug]/page.tsx,micro/page.tsx,settings/admin/page.tsx}`
- `artifacts/h38-fix/**`
