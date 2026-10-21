---
title: 写作与排版
description: 文档站的正文能力：容器提示、代码块、表格与锚点。
section: 写作
order: 10
updatedAt: 2026-10-21
---

## 从一个标题开始

正文用 Markdown 写，标题会自动获得锚点，右侧目录与锚点来自同一次渲染。下面这行是为了验证
`###` 也会进入目录。

### 三级标题也在目录里

容器提示用来把「读之前要知道的事」与正文分开。

:::note 读前提示
这是一个 **note**。它适合补充上下文，而不是打断阅读。
:::

:::tip
这是一个 **tip**：可以更短的命令、更顺手的工作流。
:::

:::warning 小心
这是一个 **warning**。删除数据之前先确认备份。
:::

:::danger 不要这样做
这是一个 **danger**。它会明确告诉你什么操作不可逆。
:::

## 代码块

代码块由 Shiki 按亮/暗两套主题高亮，右上角有复制按钮。

```ts
interface Doc {
  order: number;
  slug: string;
  title: string;
}

const byOrder = (docs: readonly Doc[]): Doc[] =>
  [...docs].sort((left, right) => left.order - right.order);
```

代码块里的指令不会被展开，下面这段会原样显示：

```markdown
:::note
这一行会被当成代码，而不是一个提示框。
:::
```

## 表格与任务列表

| 能力   | 来源                | 备注         |
| ------ | ------------------- | ------------ |
| 侧栏   | frontmatter `order` | 数字小的在前 |
| 目录   | 渲染后的标题 id     | 与锚点同源   |
| 提示框 | `:::note` 等指令    | 不使用 JSX   |

- [x] 容器提示
- [x] 代码复制
- [ ] 公式（本轮不做）
