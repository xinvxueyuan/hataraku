# H76：移除 Univer 嵌入式表格

## 删除了什么

- `sheet.tsx` / `sheet-canvas.tsx` / `univer-canvas.tsx` / `sheet-table.ts` / `sheet-table.test.ts`；
- `mdx.ts` 的 `Sheet` 白名单与相关注释；
- `@univerjs/preset-sheets-core`、`@univerjs/presets`（package/workspace catalog/lock），`pnpm install` 后 22 个包、约 122 MB 全部消失；
- 残留的 Univer 文档/护栏引用（`docs/design-system.md`、`scripts/check-design.mjs` 的 sheet 例外）。

## 保留并改写

`/docs/embedded-sheet` 保留 URL，改成「在正文里写表格」：GFM 语法、对齐、宽表格/窄屏换行、本站约定；不再出现 Univer 或 `<Sheet>`。

## 验证

生产构建 `/docs/embedded-sheet` JS 250,969 B（245 KB，13 chunks），canvas/univer 0；普通 GFM 表格在 `/docs/authoring` 与 `/blog/8` 保持。`pnpm run ready` EXIT=0；grep univer 0。详见 `evidence.txt` 与前后截图。
