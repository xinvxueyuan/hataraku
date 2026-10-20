# H3 博客 API 交付说明

## 入口

```ts
import type { AppRouterClient } from "@hataraku/api";
```

web 端经 `/rpc` 调用，mobile 端经 `AppRouterClient` 调用；两边共用同一份类型，无 codegen。

## Procedure 清单（21 个，全部 `publicProcedure`）

| Router     | Procedure                           | 输入要点                                                                                                                   | 输出                                                                 |
| ---------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `posts`    | `list`                              | `page`/`pageSize`（默认 1/12，上限 100）、`categorySlug`、`tagSlugs[]`、`featuredOnly`、`orderBy`(enum)、`direction`(enum) | `{ items, page, pageSize, total, totalPages }`                       |
| `posts`    | `bySlug`                            | `{ slug }`                                                                                                                 | 含 `bodyMd`、`category`、`comment`、`views`；缺失/草稿 → `NOT_FOUND` |
| `posts`    | `adjacent`                          | `{ slug }`                                                                                                                 | `{ previous, next }`（按发布时间）                                   |
| `posts`    | `related`                           | `{ slug, limit<=10 }`                                                                                                      | 共享标签或同分类的列表项                                             |
| `taxonomy` | `categories`                        | —                                                                                                                          | 分类 + 已发布文章数                                                  |
| `taxonomy` | `tags`                              | `minCount`（默认 1）、`orderBy`(count/name)                                                                                | 标签 + 已发布文章数                                                  |
| `taxonomy` | `overview`                          | —                                                                                                                          | `{ tags, categories, totalPosts }`                                   |
| `search`   | `query`                             | `q`、分页                                                                                                                  | `{ items, total, totalPages, query, fallback }`                      |
| `site`     | `profile`                           | —                                                                                                                          | 单行 site_profile（含 nav/hero/social）；缺失 → `NOT_FOUND`          |
| `content`  | `projects.list` / `projects.bySlug` | `status`、`featuredOnly`、分页                                                                                             | 作品集                                                               |
| `content`  | `micro.list`                        | `type`、分页                                                                                                               | 微动态（含 music 载荷）                                              |
| `content`  | `changelog.list`                    | `highlightOnly`、分页                                                                                                      | 更新日志                                                             |
| `content`  | `tools.list`                        | `category`、`featuredOnly`、分页                                                                                           | 工具箱                                                               |
| `content`  | `friends.list`                      | —                                                                                                                          | 友链（整表，不分页）                                                 |
| `content`  | `skills.list`                       | —                                                                                                                          | 技能（整表，不分页）                                                 |
| `media`    | `albums.list` / `albums.bySlug`     | `tag`、分页                                                                                                                | 相册；详情含 `photos` + `photoCount`                                 |
| `media`    | `devices.list`                      | `category`、分页                                                                                                           | 设备                                                                 |
| `media`    | `diary.list`                        | `tag`、`from`/`to`（ISO 日期）、分页                                                                                       | 日记                                                                 |
| `media`    | `timeline.list`                     | `category`、分页                                                                                                           | 时间线                                                               |

可见性规则统一：**只有 `published = true 且 draft = false` 的内容进入公开读路径**，标签/分类计数也按同一规则，所以标签云不会出现点进去是空列表的标签。

## 时间戳

输出 schema 用 `z.date()`。oRPC 的 standard serializer 会编码 `Date` 并在客户端还原，所以进程内客户端与 HTTP 客户端拿到的都是 `Date` 实例。`date` 列（`releasedAt` / `date`）是 `YYYY-MM-DD` 字符串，与数据库类型一致。

## 全文检索

`search.query` 复用迁移里的数据库函数，两阶段：

1. **AND 主查询** — `ns_tsquery_text` 把中文切成 2-gram 并用空格连接（`websearch_to_tsquery` 读作 AND），精度优先。
2. **OR 回退** — 仅当主查询 0 结果**且**术语数 ≤ 3 时改用 `ns_tsquery_text_or`。

术语数闸门是精度回归的判据：`不存在的词xyz` 会展开成 5 个术语（`不存/存在/在的/的词/xyz`），超过闸门即不回退，因此**必须返回 0 条**；而 `限流xyz` 只有 2 个术语，回退后仍能命中含「限流」的文章。返回值的 `fallback` 字段告诉 UI 是否放宽过匹配。

## 测试

`packages/api/tests/integration/` 下 6 个文件、66 个用例，全部打真库（`createTestDatabase()` 为每个文件建独立库）。`tests/support/fixtures.ts` 提供种子数据，其中：

- `rsc` 正文含「限流网关与」——中文分词补丁存在的理由；
- `existence` 正文含「存在」——**如果哪天有人把术语数闸门去掉，精度用例就会变红**，它就是那条用例的判别物；
- `draft` 是唯一挂在 `draft-only` 标签上的未发布文章——钉住标签云计数规则。

## 实现过程中修掉的 3 个真实缺陷

1. **`total` 统计的是全表**。沿用了旧仓的写法把 `(select count(*)::int from posts)` 当 select 字段，标量子查询**不受外层 WHERE 约束**，于是「按分类筛选」的 `total` 仍是全表行数。旧仓有同样的写法，但它的自检只断言 `.items.length`、从没断言 `.total`，所以一直没暴露。改为 `count(*)::int` 走查询自身的 WHERE。
2. **子查询里未限定的 `"id"`**。`${posts.id}` 在子查询内渲染为未限定列名，与外层 `posts` 的同名列形成歧义。改为显式 `"posts"."id"`。
3. **数组参数被当标量绑定**。`t.slug = any(${input.tagSlugs})` 让驱动发出 `'css'` 而非 `'{css}'`，PostgreSQL 报 `malformed array literal`。改用 drizzle 的 `inArray` 子查询。

## 有意未做（已由 Lead 裁决）

**`incrementViews`**（旧仓 `posts.views` 自增）本轮不加。理由：① 它是写路径，本任务范围明确是公开读；② 做成**免鉴权公开写接口**会带来刷量问题，需要配套**限流 + 去重窗口**（按 IP/session + 时间窗）才合理；③ 浏览数的正确形态很可能是**服务端按会话/IP 去重后自增**，而不是暴露一个裸的 increment。已记入 backlog，与后台/写路径一轮一起做。

## 门禁状态

- `vp test` → 85 passed（我的 66 + todos 10 + auth 4 + mobile 5）
- `vp run -r build` → EXIT=0
- `vp run test:e2e` → EXIT=0
- `vp check` → `packages/api/**` 零错误零警告
- `vp run knip` → EXIT=0

（过程中 `vp check`/`knip` 曾被仓库根一个他人遗留的未跟踪 `probe-h2.mjs` 阻断；该文件已由 owner 清理，未由本任务触碰。）
