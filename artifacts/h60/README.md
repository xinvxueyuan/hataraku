# H60 搜索片段：索引侧纯文本

## 结论

搜索索引的 bodyText 现在是纯文本：Orama 构建时剥掉 Markdown，片段从这份纯文本切出，展示层不再需要也不应再做去标记。标题与摘要仍保留原文。

## 改动

- packages/api/src/search/plain-text.ts：新增 markdownToPlainText（零依赖）。
- packages/api/src/search/orama.ts：构建索引时 bodyText = markdownToPlainText(bodyMd)，content 也使用纯文本；buildSnippet 直接使用已纯文本的 body，删除旧的展示层 plainTextOf。
- packages/api/src/search/plain-text.test.ts：5 个单测（去掉标记、无残留、保留 HTML 文本、空白折叠、代码下划线保留）。
- packages/api/tests/integration/search.test.ts：新增「markdown 正文 → 片段纯文本」集成用例（临时插入/删除一篇带标题、粗体、链接、图片、表格、分隔线、行内代码的文章）。

剥离规则：HTML 注释与代码围栏标记、标题井号、引用、列表标记、分隔线、表格分隔行与管道、行内反引号、粗体/斜体/删除线标记、链接只留文字、图片只留 alt、引用式链接定义；代码内容保留，下划线只在强调边界剥离，所以 limit_req_zone 这类标识符不会被拆坏。

## 片段实测（真实库，after.json）

每条片段不得出现 ](、|、**、__、反引号、--- 或行首 #；脚本断言 violations = 0。

- Goo → 「…或括号包裹。 以下三种定义等价： Code: 使用空方括号时，链接文本本身作为标识符。 代码： Google Preview: Google 强调 HTML 标签: <em>, <strong> Markdown…」
- 限流 → 「…header X-Cache-Status $upstream_cache_status; } } 限流 定义限流区域 limit_req_zone $binary_remote_addr zone=…」
- Markdown → 「…片<br/>2. 以 / 开头：用于 public 目录中的图片<br/>3. 无前缀：相对于 Markdown 文件 tags 文章的标签。 category 文章的分类。 licenseName 文章内容…」
- 安全 → 「…个较弱模型的技术。如果竞争对手通过大规模账户伪造来系统性提取模型能力，这确实构成严重的商业和国家安全威胁。 方法 vs 目的 然而，争议的焦点在于实现方式而非目的本身： 一个拥有源代码读取权限、Shell…」
- Python → 「…手动管理（C/C++）：程序员自己 malloc/free，容易出错 垃圾回收（Java/Go/Python）：运行时自动回收，但带来性能开销 所有权系统（Rust）：编译期检查，零运行时开销 Rust…」

修复前的同一条 Goo 片段含 [Google]:、Preview: ---；Markdown 片段含 | tags |；安全 片段含 **实现方式…**。after 中这些残留全部消失。

## 命中质量

| query | before 命中/首篇 | after 命中/首篇 |
| --- | --- | --- |
| Goo | 6 / 一步步用 Google AI Studio… | 6 / 同 |
| goog | 5 / 同 | 5 / 同 |
| Google | 5 / 同 | 5 / 同 |
| 限 | 13 / CSS Grid 完全指南… | 13 / 同 |
| 限流 | 1 / Nginx 反向代理与负载均衡实战 | 1 / 同 |
| 不存在的词xyz | 0 | 0 |
| Markdown | 6 / Markdown 教程 | 6 / 同 |
| 安全 | 10 / 2026年开源安全威胁态势全景报告 | 10 / 同 |
| Python | 4 / Python 异步编程… | 3 / 同 |

Python 少的一条是 Redis 文章：原文只在代码围栏的语言标记（python）里出现这个词，渲染后不是可见正文；剥离围栏标记后不再误命中。这是精度提升，不是质量下降。

## 性能（同一进程内交替跑 raw / plain 索引，bench.json）

6 轮构建、每边 120 次热查询；中位数：

| 指标 | raw（before） | plain（after） |
| --- | --- | --- |
| 冷建索引 中位 | 1508.25 ms | 1347.45 ms |
| 热查询 P50 | 4.494 ms | 4.369 ms |
| 热查询 P95 | 6.941 ms | 6.580 ms |

纯文本索引构建更快（token 更少），热查询持平略快。共享机器上单次最大值有 1–2s 抖动（其他任务并行），所以用同进程交替的中位数比较；单独测剥离本身：38 篇 / 122313 字符，中位 10.15ms（p95 35.4ms），不是构建差异的来源。

## 测试与门禁

- vp test --project unit packages/api/src/search/plain-text.test.ts → 5 passed
- vp test --project integration → 186 passed（含新增片段用例）
- pnpm run check:design → EXIT=0
- vp check → EXIT=0（281 files fmt、223 files lint/type）
- pnpm exec knip → EXIT=0
- pnpm run ready → EXIT=0（268 tests、e2e 7/7、build 成功；gate-ready.txt）

## 文件

- packages/api/src/search/plain-text.ts（新）
- packages/api/src/search/plain-text.test.ts（新）
- packages/api/src/search/orama.ts
- packages/api/tests/integration/search.test.ts
- artifacts/h60/{probe.mjs,bench.mjs,before.json,after.json,bench.json,integration-full.txt,gate-ready.txt,README.md}
