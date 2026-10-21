# H42：搜索体验（输入即搜 + 空结果建议 + 命中高亮）

## 输入即搜

- `components/search-form.tsx`（client）持有输入值；输入后 280ms 防抖，再 `router.replace('/search?q=…', { scroll: false })`；URL 仍是唯一真源，服务端页面重新取数并渲染结果。
- 输入框保持焦点；`useTransition` 的 pending 通过 `aria-live` 的轻量文案反馈，不替换输入框、不引入布局跳动。
- **中文输入法**：`compositionstart` 期间不武装防抖定时器，`compositionend` 后按最终值搜索；实测组合期间 0 请求。
- **无 JS 回退**：表单保留 `method=get action=/search`；禁用 JS 时回车仍会 GET 到同一 URL（SSR 出结果）。
- 后退/前进：URL 变化时若输入框未被本地编辑（`lastQuery` ref 判定）则同步输入值；清空输入回到 `/search`。

## 空结果建议

`app/search/page.tsx` 的 `EmptyResult` 按查询长度分支：
- ≤1 字：命中面太宽 → 换更具体的词；
- >24 字：关键词过长 → 更短的词；
- 其余：没有匹配 → 更短的词 / 看全部文章。
每种都给出 `/article` 行动入口，不是「暂无数据」。

## 高亮

`components/search-highlight.tsx`：把查询按空白拆成多个词，逐一 `escapeRegExp` 后拼成一个 `giu` 正则，`split` 出文本片段并用 React `<mark>` 拼接 —— 没有 `dangerouslySetInnerHTML`，标题/摘要里的特殊字符与 HTML 都只是文本。前缀命中（`Goo` → `Google`）高亮命中的那段；大小写不敏感。
`<mark>` 用 `bg-primary/15 text-foreground`，两套主题实测对比度 light 13.94 / dark 13.84。

## 验证

键盘逐字、IME 组合、空结果、`Goo`/`a.b`、SSR 分享链接、前进/后退、390/1440 截图均见 `evidence.txt`；e2e 7/7；`pnpm run ready` EXIT=0。

## 未做/取舍

- 搜索框没有做「点空白清空」等额外交互；`type=search` 自带清空按钮。
- 高亮只覆盖标题与摘要（结果条目的可见字段）；正文命中原因仍是后端返回的排序。
