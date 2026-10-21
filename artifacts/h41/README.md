# H41 · 把全文搜索从 Postgres 换成进程内 Orama

## 1. 结论

- 搜索读路径改为**进程内 Orama 索引**，Postgres 仍是唯一事实源（source of truth）。
- 前缀命中已修复：`Goo` / `goog` / `限` / `网` 均不再为 0。
- 精度门保持：`不存在的词xyz` 仍为 0。
- 旧的 `search_index` / 触发器 / `ns_tsquery_*` 本轮**保留但不再读取**；模块头注释写明了移除条件与三步迁移，见 §8。
- `fallback` 已从 schema 与搜索页彻底移除（不再有双重表示）。
- 门禁：`pnpm run ready` EXIT=0（213 个单测/集成测试 + 7 个 e2e + build），`vp check` 200 个文件全绿。

## 2. 架构与失效策略

实现：`packages/api/src/search/orama.ts`，路由 `packages/api/src/routers/search.ts`。

- 索引字段：`title / description / bodyText / tags / category / content`；`content` 是其它字段的拼接，权重 1，只用于跨字段召回（Orama 的 threshold 要求“所有词在同一字段”，没有它，标题+正文各命中一半的查询会丢）。
- 权重：title 5、description 2、tags 2、bodyText/category/content 各 1。
- 缓存：`WeakMap<Database, {database, signature, tokensBySlug}>`，按 `Database` 实例隔离（同一进程里的测试库/生产库互不串）。并发重建用 `WeakMap<Database, Promise<...>>` 合并，避免同一时刻重复建索引。
- 失效签名：一条聚合查询 `select count(*), max(updated_at) from posts where published and not draft`。仓库里所有写路径（内容、发布状态、标签同步）都会写 `posts.updated_at`，因此一次聚合覆盖这三类变化。签名不变则直接用缓存；变了才重建（38 篇量级为百毫秒级，见 §6）。
- 重建是惰性的：每次查询先算签名；首次查询/数据变更后的首次查询触发重建，之后是纯内存查询。

## 3. 分词器：为什么没有用 `@orama/tokenizers/mandarin`

本来按方案用官方 mandarin 分词器（`Intl.Segmenter("zh-CN", {granularity:"word"})`）。实测发现它是**上下文相关**的，同一段文字在“查询侧”和“文档侧”切分不一致：

| 输入 | mandarin 分词器输出 |
| --- | --- |
| 查询 `限流` | `["限","流"]` |
| 文档里的 `限流区域` | `["限流","区域"]` |

Orama 的前缀匹配只从 token 首字符往后匹配，所以查询 token `流` 永远匹配不到 `限流` 里面的“流”。实测后果：**正文含“限流”三次的 Nginx 文章，用 `限流` 搜不到**（不是排名靠后，是 0 命中）。这正好是“前缀/中文都打不到”的一类根因，因此换成分词结果与上下文无关的自定义 tokenizer：

- 每个汉字连续段（Han run）拆成**单字 + 相邻二字组（bigram）**；
- 非汉字段按非字母数字切分并小写（`Goo` → `goo`，`goo` 通过 radix 前缀命中 `google`）；
- 复用 `@orama/stopwords/mandarin` 的中文停用词表过滤 token；
- 不再依赖 `@orama/tokenizers`（已从依赖与 catalog 里移除，保留 `@orama/orama` 与 `@orama/stopwords`）。

代价（已实测）：CJK 的 token 数约翻倍（单字+bigram），冷建索引从 ~240ms 涨到 ~640ms；换来查询/索引切分完全一致、前缀可用、词组精度由 bigram 保住。放弃的是 ICU 词典的“词”知识，用 bigram 近似。

## 4. Orama threshold 的坑与自定义 AND

Orama 的 `threshold: 0` + 前缀会**按“命中的 word 数”而不是“命中的 token 数”计数**：查询 `限流` 的 token 是 `限 / 流 / 限流`，其中 `限` 同时前缀命中 `限` 和 `限流` 两个 word，计数变成 4，而 `keywordsCount` 是 3，于是**整篇被丢弃**（实测 `限流` 因此从 1 变成 0）。

因此路由改为：

1. 用 `threshold: 1` 让 Orama 返回并集（含部分命中）；
2. 自己应用 AND：**每个查询 token 必须是文档某个 token 的前缀**（文档 token 在构建时存进 `tokensBySlug`）。

这同时就是精度门：`不存在的词xyz` 需要 `不存 / 存在 / 在的 / 的词 / xyz` 同时出现，语料里没有，结果 0。单 token 查询（`Goo`、`限`）走同一条路径，不依赖 Orama 的阈值语义。

## 5. 排序

1. **字面命中优先**：查询串在 title/description/body 中的出现次数（title ×100、description ×10、body ×1）从高到低——用来把“含 `限流` 这个词组”的文章排在“只分别含 限、流 两个字”的文章前面；
2. Orama BM25 分数；
3. `published_at` 新的在前（同分兜底）。

分页在本模块内完成（先取全量命中再排序切片），因为第二排序键无法在不全排序的情况下交给 Orama。响应仍保持 `items/page/pageSize/total/totalPages`，`rank` 为 Orama 分数。

## 6. 性能实测（真实库，38 篇已发布）

`artifacts/h41/bench.mjs`（进程内直调，最终代码）：

| 指标 | 值 |
| --- | --- |
| 冷建索引 | 643.73 ms |
| 冷查询（含签名 + 建索引） | 574.24 ms |
| 索引文档数 | 38 |
| 热查询 P50 | 2.236 ms |
| 热查询 P95 | 3.200 ms |

HTTP 页面（`artifacts/h41/probe-http.mjs`，真实 API+Web dev，SSR 毫秒数含 Next dev 开销）：

| 查询 | 命中数 | 第一篇 | 页面 ms |
| --- | --- | --- | --- |
| `Goo` | 6 | 一步步用 Google AI Studio 做出并部署自己的 Android 应用 | 1445.6（首次编译） |
| `goog` | 5 | 同上 | 189.7 |
| `Google` | 5 | 同上 | 248.0 |
| `google ai` | 2 | 同上 | 242.9 |
| `限` | 13 | CSS Grid 完全指南：告别 Flexbox 局限 | 231.1 |
| `限流` | 1 | Nginx 反向代理与负载均衡实战 | 175.2 |
| `限流网关` | 0 | - | 165.0 |
| `网` | 13 | 一封封号邮件里的 1×1 像素：Claude 邮件追踪器技术分析与争议 | 185.4 |
| `网关` | 0 | - | 141.6 |
| `不存在的词xyz` | 0 | - | 151.5 |
| `a&b` | 30 | Markdown Mermaid 图表 | 190.6 |

## 7. 语料事实：为什么 `网关` / `限流网关` 是 0

`artifacts/h41/corpus-check.txt`：

| 指标 | 值 |
| --- | --- |
| posts 总数 | 39 |
| 已发布且非草稿 | 38 |
| 正文/标题含“限流” | 1 |
| 正文/标题/摘要含“网关” | **0** |
| 正文含“流网” | **0** |

即：**没有一篇文章包含“网关”这个词**，所以 `网关`（bigram 网关）为 0 是语料事实，不是分词/前缀坏了；`限流网关` 还要求 bigram 流网，同样 0。集成测试里 fixture 文章含“限流网关”，`网关` 与 `限流网关` 都能命中（见 `packages/api/tests/integration/search.test.ts` 的 23 个用例），证明查询路径本身可用。单字 `限` / `网` 分别命中 13 篇，说明前缀/中文单字已通。

## 8. 旧路径（search_index / 触发器 / ns_tsquery_*）的去留

本轮**不删表、不改历史迁移、不读旧列**。旧表在每次写入时仍由触发器维护，属于“写但不读”的过渡态；模块头注释写明了：

- 移除条件：新路径跑满一个发布周期且没有搜索回归；
- 移除步骤（新迁移，不在本轮）：
  1. 确认仓库与查询日志里没有 `search_index` / `ns_tsquery_` 的引用；
  2. drop 两个触发器 `posts_search_index_sync` / `post_tags_search_index_sync`，再 drop `refresh_search_index`、`search_index_sync_from_posts`、`search_index_sync_from_post_tags`、`ns_tsquery_terms`、`ns_tsquery_text`、`ns_tsquery_text_or`、`ns_cjk_ngrams`、`ns_tsvector_text`，最后 drop 表 `search_index`；
  3. 删除 `packages/db/src/schema/search.ts` 及其 relations 条目，以及引用旧路径的测试。

## 9. 契约变化

- 输入不变：`q / page / pageSize`。
- 输出：`items / page / pageSize / total / totalPages / query`；`items[].rank` 保留（Orama 分数）。
- **删除** `fallback`：`packages/api/src/schemas.ts` 的 `searchResultSchema` 与 `apps/web/src/app/search/page.tsx` 的“已放宽为任意词匹配”文案一并移除。

## 10. 验证

- `pnpm run ready` → EXIT=0；213 passed（含 search 集成 23 个），e2e 7/7，build 成功。
- `vp check` → 200 files，格式化/类型/lint 全过。
- `vp run knip` → EXIT=0。

## 11. 变更文件

- `pnpm-workspace.yaml`、`pnpm-lock.yaml`：catalog 增加 `@orama/orama@3.1.18`、`@orama/stopwords@3.1.18`。
- `packages/api/package.json`：新增上述两个依赖。
- `packages/api/src/search/orama.ts`（新）：索引、缓存、分词、AND 过滤、排序。
- `packages/api/src/routers/search.ts`：改调 `searchPosts`。
- `packages/api/src/schemas.ts`：移除 `fallback`。
- `packages/api/tests/integration/search.test.ts`：23 个用例（ASCII/前缀/中文单字与词组/精度门/草稿/注入/分页/排序/文档数）。
- `apps/web/src/app/search/page.tsx`：移除 `fallback` 文案与注释。
- `artifacts/h41/`：本报告、bench 与 HTTP 探针、语料核对、原始结果 JSON。

## 12. 已知边界

- `a&b` 命中 30：单字母 Latin token（`a`、`b`）作为前缀会匹配大量英文单词；不 500，但召回很宽。若要收紧，可只对 ≥2 字符的 Latin token 建索引/查询，本轮未改。
- `限` 的第一篇是含“局限”的 CSS Grid 文章：单字查询没有唯一目标，排序按字面出现次数，属预期。
- `限流网关` / `网关` 为 0 是语料不含该词（§7），不是回归。
- 冷建索引 ~640ms：发生在进程启动后的第一次搜索（或数据变更后的第一次），之后单次查询 ~2ms。
