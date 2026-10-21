# H44：正文命中片段（snippet）

## 后端

- `packages/api/src/search/orama.ts`：搜索命中后，仅当**标题与摘要都不含查询 token** 时，从 Orama 文档已有的 `bodyText` 生成片段；没有新增数据库查询或全表扫描（`bodyText` 本来就在索引文档里，H41 建立）。
- 片段先经 `plainTextOf` 去掉围栏/标题/引用/链接语法，压成一行；窗口为命中前后各 48 字符，随后按 Latin 词边界外扩（CJK 不按「词」扩，避免扩到整段），并在 UTF-16 代理对边界回退，保证不劈字。
- 返回纯文本 + `matches: [{start,length}]`；不返回 HTML。
- 只在分页切片之后生成，最多 pageSize 条；标题/摘要命中时返回 `snippet: null`。
- 契约：`packages/api/src/schemas.ts` 的 `searchHitSchema` 增加 `snippet`（nullable）。

## 前端

- `apps/web/src/app/search/page.tsx`：`snippet` 非空才渲染一行 `[data-slot=search-snippet]`，避免与摘要重复。
- `search-highlight.tsx` 的 `highlight()` 增加可选 `matches`：片段直接使用服务端区间，标题/摘要仍用原分词/转义路径；`<mark>` 的 class 共用同一个常量。没有第二份分词或高亮实现，也没有 `dangerouslySetInnerHTML`。

## 测试

`packages/api/tests/integration/search.test.ts` 新增：
1. 正文命中返回片段，区间切片等于「限流」；
2. 标题命中（状态层）/摘要命中（银弹）返回 `snippet: null`；
3. 拉丁长词在片段边界保持完整；
4. 正文里的 `<b>&` 按纯文本返回，不含 `<mark`。

## 实测

- 限流：片段两条 `限流` 高亮；局限：无片段、1 个 mark；Google：首条无片段，其余正文命中条目各有片段。
- RPC 热路径：有片段 33–35ms / 无片段 37ms（P50，各 50 次），无显著劣化。
- e2e 7/7；集成测试 27/27。
