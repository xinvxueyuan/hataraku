# H11 · @univerjs/sheets 只读嵌入：上次为什么挂载失败

结论先说：**嵌入已经跑通**。文档正文里的 Markdown 表格会被渲染成一张只读的 Univer 表格，
canvas 真实绘制（列头 A/B/C、行号、单元格文字都在），容器 `pointer-events-none`，没有回写路径。
上一次的「挂载即崩」不是一个 bug，而是三个独立原因叠加，外加一个我误判为页面 bug 的工具环境噪声。

## 真因一：`blockJS` 会把 JSX 属性表达式静默删掉

`next-mdx-remote` 的 `serialize` 默认 `blockJS: true`，它会挂上 remark 插件
`removeJavaScriptExpressions`，把 MDX 里的 `{...}` 表达式删掉 —— **包括 JSX 属性值**：

```js
// node_modules/next-mdx-remote/dist/plugins/remove-javascript-expressions.js
// Blocked patterns:
// - JS expressions: {variable}, {func()}, {obj.prop}
// - JSX attribute expressions: <Component prop={value} />
```

所以 <Sheet rows={[...]} /> 编译后到达客户端时，`rows` 已经不存在了（`label="..."` 这种字符串属性保留）。
这正好解释上次的 `pageerror`：`rows` 是 `undefined`，引擎读属性时抛 TypeError，React 把整个 figure 卸载。

**验证方式**（当时用的探针，保留在 `artifacts/h11/render-probe.mjs` 同思路的 RSC 读取里）：
把页面 HTML 里的 `self.__next_f.push` payload 解出来，元素是
`["$","$Lcd",null,{"label":"内容管线 · 只读快照"}]   ← rows 没了`。

**修法**：正文用 Markdown 表格承载数据，组件从 `children` 里读表，不经过表达式属性。
白名单仍是安全边界（`mdx.ts` 里那段注释保留并补充了这条约束）。

## 真因二：`createWorkbook` 的部分快照不渲染

上次的写法是 `univerAPI.createWorkbook({ sheets: { sheet1: { cellData } } })`。
这是合法 TS（`Partial<IWorkbookData>`），**模型里数据是全的**（`getRange("A1").getValue()` 能读到），
但画布只画出空白网格 + 一个 A1 选区，连行列头都不画。

决定性证据：给画布打桩统计 2D context 调用。

| 写法 | `fillText` 调用 | 渲染结果 |
| --- | --- | --- |
| `createWorkbook({ sheets: { sheet1: { cellData } } })` | 0 | 空白网格 |
| `createWorkbook({})`（文档里的空工作簿） | 252（行号 1,2,3…） | 正常 |
| 完整快照（下表） | 138（含「阶段」「归属」「产物」…） | 正常 |

**完整快照需要**：workbook 的 `id` / `name` / `sheetOrder`，sheet 的 `id` / `name` / `rowCount` / `columnCount`。
只补 `rowCount`/`columnCount` 不够（试过，仍然 0 次 fillText）。

## 真因三：`locales` 不能省

`createUniver` 不传 `locales` 时，公式引擎在 UI 渲染阶段调用 `LocaleService.t()`，直接抛
`[LocaleService]: Locale not initialized`（栈：`DescriptionService._initDescriptions` ← `sheets-formula-ui` 的 React 渲染）。
传 `locales: {}`（空对象）不抛，但全部文案显示为 key。正确写法是 preset 的语言包 + `mergeLocales`。

## 环境噪声：MCP 的 Playwright 页面是 hidden

`document.visibilityState === "hidden"` 时 Chromium 不跑 `requestAnimationFrame`，而 Univer 靠 rAF 绘制。
于是：**页面本身没问题，但 MCP 浏览器截图里表格永远是空白**。测法：

```js
document.visibilityState            // "hidden"
new Promise(r => requestAnimationFrame(r))   // 3s 都不触发
```

所以证据改用脚本自带的 Chromium（`artifacts/h11/browser-evidence.mjs`），它是可见上下文，rAF 正常。
另外用本机 Chrome（`H11_BROWSER_EXE`）也复跑过一遍，结论一致。

## 证据

```sh
node artifacts/h11/browser-evidence.mjs http://localhost:3300/docs/embedded-sheet artifacts/h11/embed-browser.png
```

输出（真实 Chromium，可见上下文）：

```json
{
  "canvases": [
    { "buffer": [0, 0], "drawn": 0, "size": [0, 0] },
    { "buffer": [590, 417], "drawn": 28603, "size": [590, 417] }
  ],
  "errors": [],
  "paintedCanvases": 1,
  "pointerEvents": "none",
  "sizedCanvases": 1,
  "visibility": "visible"
}
```

- `[data-slot=sheet-canvas] canvas` 命中 2 个，其中 1 个尺寸 > 0（590×417），且真的画了 28603 个像素；
  另一个 0×0 的是公式编辑器的隐藏 canvas，属正常。
- 截图：`artifacts/h11/embed-browser.png`（列头 A/B/C、行号 1–5、表格正文、A1 选区、图注）。
- 控制台错误：0。

## 复现脚本

| 文件 | 作用 |
| --- | --- |
| `browser-evidence.mjs` | 可见 Chromium 打开页面，断言 canvas 数量/尺寸/已绘制像素，存截图 |
| `render-probe.mjs` | 给 `CanvasRenderingContext2D` 打桩，统计 `fillText` 与合成层像素，用来区分「没渲染」和「渲染了但看不见」 |

两者都支持 `H11_BROWSER_EXE` 指向本机 Chrome/Edge。

## 实现要点（现状）

- `apps/web/src/components/univer-canvas.tsx`：引擎。`createUniver` + preset + 完整工作簿快照；
  只通过 `next/dynamic(ssr: false)` 进入浏览器，样式表同块懒加载。
- `apps/web/src/components/sheet-canvas.tsx`：`"use client"` 的 `next/dynamic` 包装。
- `apps/web/src/components/sheet.tsx`：服务端组件，解析 `children` 里的表格 + 只读外壳。
- `apps/web/src/components/sheet-table.ts`（+ `.test.ts`）：Markdown 表格 → 字符串网格，5 个单测。
- `apps/web/src/server/mdx.ts`：`ALLOWED_COMPONENTS = { Sheet }`，白名单=安全边界的注释保留并补充了
  「表达式属性会被编译器剥掉」这条约束。
- 正文示例：`apps/web/content/docs/embedded-sheet.md`。
