# H83：toolbox 拆成 hub + 4 个子页，about 重排层级

## 1. 拆页

| 路由 | 内容 | 生产实测条数 |
| --- | --- | --- |
| `/toolbox` | hub：四张卡片，各带一句说明与自己的条数 | 0 / 2 / 5 / 0 |
| `/toolbox/tools` | 工具列表（保留分页，每页 12） | 0 → 空态 |
| `/toolbox/devices` | 设备列表 | 2 |
| `/toolbox/skills` | 技能列表（按分类分组） | 5 |
| `/toolbox/friends` | 友链列表 | 0 → 空态 |

- 共享组件：`apps/web/src/components/toolbox-section.tsx`（返回入口 + 标题 + 说明 + 条数 + 空态/内容 + 可选分页）、`apps/web/src/components/toolbox-hub-card.tsx`（hub 单卡）。四个子页只写自己的行与自己的空态文案，没有四份重复骨架。
- 空模块不伪装：hub 上「工具 0 个工具 → 还没有内容」「友链 0 位朋友 → 还没有内容」，卡片仍可点进各自的诚实空态。
- 计数来自子页所用的同一批 procedure（hub 用 `pageSize: 1` 只取 total），hub 与子页不会互相矛盾。
- 导航不变：`nav-links` 的「工具箱」本就指向 `/toolbox` 且用 `isSection` 判活，子页时「更多」触发器高亮；子页顶部有 `← 工具箱` 返回入口。

## 2. about 重排（单页，不拆路由）

- 首屏是一个 `min-h-svh` 的 identity hero：头像 + 姓名 + 英文名 + 一句话（tagline / description）+ 作者，其余内容整体在首屏之下（1440 与 390 截图均如此）。
- 站点数据从 4 张大卡片改成 hero 内的一行 stat（文章 · 分类 · 标签 · 相册，取值见截图），仍是链接。
- 时间线当前 0 条：**整段不渲染**，页面上不出现「时间线」标题（脚本实测 `hasTimelineHeading: false`）。
- 「逛逛」与「联系方式」降到页尾，小写字距标题 + 无边框轻量列表。

## 3. 证据

- 截图：`h83-{hub,tools,devices,skills,friends,about}-{1440,390}.png`
- 溢出与状态实测：`measure.mjs`（playwright-core 驱动本机 Chromium）→ `measure-1440-390.json`：六个路由 × 两种宽度全部 200，`scrollWidth === clientWidth`，无越界元素。
- 全量门禁：`evidence-ready.txt`；拆分范围门禁：`evidence-scoped.txt`。
