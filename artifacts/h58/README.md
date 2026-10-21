# H58：评审修复（前端工艺）

修复 A2 / A3 / A4 / A5 / A7 / B5。

## 改动

- **A2 封面占位**：`PostCover` 在无 `coverKey`/`coverSrc` 时返回 `null`；删除「灰框 + 首字」占位。没有真封面时文字占满卡片/正文，读者不会误以为图片坏了。
- **A3 重复 h1**：文章页 `prepareBody` 去掉与页头同文的 `# title`，其余 `#` 降为 `##`（跳过围栏代码）。正文不再产生 h1，页面只有页头一个 h1。
- **A4 首页层级**：h1 升到 `sm:text-5xl`（48px）；区块标题改为 14px uppercase muted label；首篇标题 24px/600（与 /article lead 一致），其余 18px/500。
- **A5 长文目录**：复用 `@hataraku/components/table-of-contents`；文章页 xl 右侧 sticky 目录，窄屏 `ArticleTocMobile` 用 `use-disclosure` 做抽屉（四条关闭路径）。
- **A7 容器节奏**：admonition 标题/正文去掉 prose 默认 margin，统一 `m-0` + `leading-6`，四种容器正文起点一致。
- **B5 分页禁用态**：共享 Pager 与 `/article` 内联 pager 的禁用项改为 `opacity-30 + pointer-events-none + cursor-not-allowed`。

## 验证

见 `evidence.txt`：h1=1；TOC 9/9 与标题 id 一致；封面占位 0；四种容器基线一致；禁用态 computed 值；对比度 light 10.1/6.02、dark 13.02/6.62；check:design / vp check / knip / e2e 7/7 / build 均通过。

## 说明

- 移除 `renderMdx` 导出（页面全部改用 `renderMdxWithToc`，knip 不再报未使用）。
- 未改 `packages/ui/src/styles/**`；色块/高亮全部走既有 token。
