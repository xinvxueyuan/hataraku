# H25 P1：机器可读面覆盖新页面

## 改动

| 端点 | 改动 |
| --- | --- |
| `/sitemap.xml` | 静态页从 7 条扩到 11 条：新增 `/micro` `/projects` `/toolbox` `/changelog`；**不写 `?page=` 变体**（见下） |
| `/llms.txt` | 页面清单补四页；新增 微文 / 项目 / 工具箱 / 更新日志 四个内容段（有数据才出现）；站点信息加三类计数 |
| `/llms-full.txt` | 文章正文由「800 字摘要」**恢复为全文**（与 v2 一致），上限 50 篇；新增微文全文与更新日志全文（changes + bodyMd），上限 100 条 |
| `/rss.xml` | 新增 `content:encoded` 全文（转义 markdown 文本），`description` 保持「描述或 240 字摘要」；条目上限 20（与 v2 一致） |
| `/atom.xml` | 新增 `<content type="text">` 全文，`summary` 保持「描述或 240 字摘要」；条目上限 20 |
| `components/site.ts` | 新增 `loadAllRows`：把分页 procedure 拉全并按 id 去重（上限 10 页/1000 行），三个端点共用 |

## 与 v2 的比对结论

- **llms-full 800 字是遗留偏差，不是有意设计**：v3 原注释写的是“摘要控制体积”，但 v2（`nightstack/src/app/llms-full.txt/route.ts`）明确是“文章正文原样输出”，且用 `LLMS_FULL_LIMIT = 50` 控制篇数。本次按 v2 对齐：全文 + 50 篇上限，文件头写 `文章数: 50 / 全站 N` 让上限可见。
- **RSS/Atom 应带正文**：v2 的 item 有 `content:encoded`、entry 有 `<content type="text">`（`nightstack/src/app/rss.xml/route.ts`、`atom.xml/route.ts`），v3 之前只有 description/summary，属内容退化。本次对齐；正文与 v2 一样按转义文本写入（不是裸 HTML），保证 XML 良构；条目上限 20 与 v2 的 `FEED_ITEM_LIMIT = 20` 一致。
- **sitemap 不写分页 URL**：v2 也没有分页条目；且四个列表页的 canonical 由 `./` 推导、会丢掉 `?page=`，分页副本对爬虫是同一页，写进 sitemap 会自相矛盾。分页页仍可从列表内的“下一页”爬到。

## 空数据处理（当前 `/micro` 与 `/changelog` 均为 0 行）

- `sitemap.xml`：四个页面的 URL **始终出现**（页面存在，只是暂时没有条目）。
- `llms.txt`：页面清单始终包含四页；内容段按「有数据才出现」——空的微文/更新日志不打印空标题；站点信息用 `微文: 0 条` / `更新日志: 0 条` 明确表达空状态。
- `llms-full.txt`：文件头写 `微文: 0 / 全站 0`、`更新日志: 0 / 全站 0`，不出现逐条标题；文章段照常。
- 结论：机器读者能从计数与页面清单知道“这个类型存在但暂时为空”，比打印空标题更可解析。

## 验证

```powershell
# 空库/迁移后基线（当前库 micro=0、changelog=0）
node artifacts/h25/probe.mjs http://localhost:3302 38 38 7 97 1 --marker "archives/127348.html"
# 临时 fixture：3 条微文 + 3 条更新日志
Get-Content -Raw artifacts/h25/fixtures.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
node artifacts/h25/probe.mjs http://localhost:3302 38 38 7 97 1 --marker "archives/127348.html" --fixtures
Get-Content -Raw artifacts/h25/cleanup.sql | docker exec -i hataraku-db-1 psql -U postgres -d hataraku -v ON_ERROR_STOP=1
```

- 两种模式全 PASS（`evidence-baseline.txt`、`evidence-fixtures.txt`）。
- 断言覆盖：sitemap 154 个 URL（11 静态 + 38 文章 + 7 分类 + 97 标签 + 1 相册）且含四页、无 `?page=`；llms.txt 四页链接 + 计数 + 三个内容段（fixture 模式下微文 3/更新日志 3）；llms-full 无“正文摘要”、含文章正文尾部标记（`archives/127348.html`）、fixture 模式下含微文全文与 changes；RSS/Atom 各 20 条且正文标记数=条目数。
- `raw-empty/`、`raw-fixtures/` 保留了 `curl -D` 的响应头与响应体（Content-Type 分别为 `application/xml`、`text/plain; charset=utf-8`、`application/rss+xml; charset=utf-8`、`application/atom+xml; charset=utf-8`）。
- 门禁：`vp check`（含 fmt）在 6 个文件上 0 error；`pnpm run ready` 见 `evidence-ready.txt`。

## 备注

- 3300 被其他任务的 preview server 占用，本次实测用 3302（未杀他人进程）。
- 未改四个页面组件与 `/settings/**`；feed 的正文通过 `loadPostBody`（`posts.bySlug`）读取，未新增 procedure。
- 版本号与标题等中文内容不进入 URL 编码逻辑；URL 均由 `absoluteUrl(origin, path)` 生成，无域名硬编码。
