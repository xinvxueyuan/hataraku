# H73 search result context

## 现状 → 改动

搜索命中原本已有 `categorySlug`、`publishedAt`；索引文档已有 `category`（slug）、`tags`、`publishedAt`，但：

- 响应没有任何 tag 字段；
- 索引文档和响应都没有阅读时长；
- 结果只有标题/摘要/片段/日期，弱于文章列表（列表有 `categorySlug`、`tags`、`readingMinutes`、日期）。

改动：

- `packages/api/src/search/orama.ts`：索引 select/文档增加 `readingMinutes`；SearchHit 增加 `tags`、`readingMinutes`；null/0 用 0 作为 Orama 的哨兵，输出时还原 null。
- `packages/api/src/schemas.ts`：searchHitSchema 增加 `tags: string[]`、`readingMinutes: int | null`。
- 排序比较器显式化为 `compareRanked`：精确短语分 → Orama BM25 分 → `publishedAt` 倒序。只有前两者**严格相等**才看时间；分数接近但不相等仍按相关性，绝不改变相关性主导。
- 公开字段：`openapi-public.ts` 只维护路由 allowlist，不手写字段；OpenAPI 从 `searchResultSchema` 自动生成，因此不需要改路由元数据。
- 未改 web；`categorySlug` 保持与 `postSummarySchema` 一致。

## 四条查询字段实况

完整逐条表：`queries-after.txt`（含改前对照，改前 tags/readingMinutes 为 MISSING）。

- `Goo`：6 条；id 39/32/7/38/37/13，categorySlug ai/frontend/examples/安全/technology/technology，tags 与 readingMinutes 已逐条填充。
- `限流`：1 条；id 15，devops，tags load-balancing/nginx/proxy，5 分钟。
- `Markdown`：6 条；id 7/3/6/5/4/38，categorySlug examples×3/guides/technology/安全，阅读时长 11/4/2/2/3/7。
- `安全`：10 条；id 38/12/36/11/10/9/34/15/39/37，阅读时长 7/5/16/5/3/5/2/5/12/12。

`publishedAt` 全部来自索引文档的毫秒时间戳，输出为 Date/null。

## 同分次级排序证据

`artifacts/h73/tie.mjs` 插入两篇 title/body/description 完全相同的临时文章，仅发布时间不同；查询 `tiebreakprobe`：

```text
tie-new-probe  rank=22.39484973658987  publishedAt=2021-01-01
tie-old-probe  rank=22.39484973658987  publishedAt=2020-01-01
```

两篇 rank 完全相同，新的（2021）排在旧的（2020）前面；集成测试 `breaks a relevance tie by publish date, newest first` 同样断言 rank 相等与顺序。临时行已清理，posts 仍为 39。

## 性能（同一本地库，真实 38 篇）

`artifacts/h73/bench-before.mjs`：6 次冷建、120 次热查询 `限流`。

| 指标 | 改前（before.json） | 改后（after.json） | H41/H60 历史基线 |
| --- | ---: | ---: | ---: |
| 冷建索引中位 | 853.379 ms | 654.006 ms | 643.73 ms |
| 热查询 P50 | 4.589 ms | 2.956 ms | 2.236 ms |
| 热查询 P95 | 6.585 ms | 4.299 ms | 3.200 ms |

改后比改前同机更快，和历史基线同一量级（共享机器波动明显；H60 另一次记录为 519.21/2.752/3.512 与 993.2/4.284/5.263）。补字段没有带来热查询退化。

## 门禁

- `pnpm run test --project unit`：94 passed
- `pnpm run ready`：EXIT=0（291 tests、e2e 7/7、build 成功；仓库内未跟踪 explore/ 临时移出）
- `check:compat` / `check:design` / `knip`：0
- 搜索集成测试：30 passed（含字段上下文与同分排序）

## 文件

- packages/api/src/search/orama.ts
- packages/api/src/schemas.ts
- packages/api/tests/integration/search.test.ts
- artifacts/h73/{README.md,before.json,after.json,bench-before.mjs,tie.mjs,tie.txt,queries-after.txt,unit.txt,ready.txt,compat.txt,design.txt,knip.txt}
