---
title: 嵌入表格
description: 正文里可以放一张只读的电子表格，数据就写成 Markdown 表格。
order: 3
updatedAt: 2026-10-20
---

## 数据写成表格，不是 props

`<Sheet>` 的内容是一张 Markdown 表格：表头照旧，其余每一行就是表格的一行。

正文编译时关掉了 JavaScript 表达式（`blockJS`），`rows={[…]}` 这样的属性会在编译期被静默丢掉。表格是纯 Markdown，不受这道限制，写出来的样子也跟看到的样子一致。

## 只读，没有回写路径

单元格里只有值，没有公式，也接不到编辑：外层容器是 `pointer-events-none`，点击、拖选、聚焦都落不到画布上。

引擎走 `next/dynamic` 的 `ssr: false`，只在浏览器里加载，而且只在真的有表格的页面上加载，所以首屏包里既没有 Univer，也没有它的样式表。

## 它为什么能进白名单

正文来自数据库，所以 `renderMdx` 只把 `Sheet` 交给编译器。MDX 的大写标签只会解析到这份组件表；`Sheet` 只读 props 与 children、返回 DOM，不执行任何字符串，这是白名单作为安全边界的前提。

<Sheet label="内容管线 · 只读快照">

| 阶段 | 归属               | 产物         |
| ---- | ------------------ | ------------ |
| 采集 | Velite             | content/docs |
| 守卫 | assertSafeMdx      | 拒绝模块语法 |
| 渲染 | renderMdx          | React 元素   |
| 组件 | ALLOWED_COMPONENTS | Sheet        |

</Sheet>

表格上方没有工具栏、表头或公式栏，因为它只负责显示。盒子固定 420px 高：超过视野的行不会滚动出来 —— 它是一张只读快照，不是可操作的工作表。
