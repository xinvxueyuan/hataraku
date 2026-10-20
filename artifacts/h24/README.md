# H24 · 文章写作字段补全 + 分类/标签/封面写入方

H22 对账的 P0：`tags` / `categories` / `post_tags` 三张表没有任何写入方，新文章进不了分类与标签体系，
taxonomy 页永远只有迁移来的旧数据。这一轮把写路径补齐，表单也补齐。

## schema 先核对过（没有新增迁移）

`packages/db/src/schema/` 里列早就带过来了，缺的只是写入方：

| 表 | 已存在的列 |
| --- | --- |
| `posts` | `categoryId` / `categorySlug` / `coverKey` / `cover`(旧 JSON) / `featured` / `publishedAt` / `readingMinutes` / `comment` |
| `categories` | `slug`(唯一) / `name` / `accent` / `description` / `sortOrder` |
| `tags` | `slug`(唯一) / `name` / `accent` / `description` |
| `post_tags` | `postId` + `tagId` 复合主键（**没有外键**，见下） |

所以这一轮**没有动 `packages/db`**，也没有生成迁移。

## 写路径

`posts.create` / `posts.update` 新增字段（全部仍走 `adminProcedure`）：

- `categorySlug`（`null` = 不分分类）：分类不存在时**按 slug 新建**，名称默认等于 slug；表单也可以顺带给 `categoryName`。
  同时写 `categoryId` 与 `categorySlug`，因为读路径按 `categorySlug` 过滤（`posts.list({ categorySlug })`），
  详情页的 join 用的是 `categoryId` —— 两列必须一起维护。
- `tagSlugs`：逐个 upsert 标签，再**按差集**更新 `post_tags`（只删多出来的、只插缺的）。
  不整表重建是有原因的：`post_tags` 上有触发器维护 `search_index`，重建会把整篇文章的索引行抖一遍。
- `coverKey`：写入时把旧的 `cover` JSON 置空，避免「`cover.src` 比 `coverKey` 优先」的读法让作者看到旧封面。
- `featured`、`publishedAt`（`YYYY-MM-DD`，存当天 UTC 零点；显式日期优先于发布时自动盖的时间戳）。

另外两处顺带修掉的正确性问题：

1. **`posts.remove` 现在先删 `post_tags` 再删文章。** 迁移过来的 `post_tags` 没有外键，不显式删就会留下指向已删文章的孤儿行（v2 也踩过）。
2. `create` / `update` / `remove` 放进同一个事务：文章与它的标签关联要么一起成功，要么一起回滚。

## 后台表单

`/settings/admin/posts/[id]` 增加：分类（`<datalist>` 列出现有分类，可直接输入新 slug）、标签（逗号分隔，不存在则新建）、
封面（复用 H18 的 `media.uploads.presign` 直传）、精选开关、发布日期。页面在读取时预取 `taxonomy.categories()` 供补全。

`ImageUploader` 的 `prefix` 类型现在**从客户端自己的契约推导**（`api.media.uploads.presign` 的入参），不再手写 `"micro" | "projects"`，
所以 `"posts"` 直接可用而不会漂移。

## 联动验证（真机）

```sh
node artifacts/h24/taxonomy-journey.mjs http://localhost:3300
```

跑在 `next build` + `next start` 的生产产物上，exit 0，9 项断言全 true：

```json
{
  "categorySlug": "frontend",
  "checks": {
    "taxonomyReused": true,
    "coverUploadedFromBrowser": true,
    "categoryPageListsPost": true,
    "tagPageListsPost": true,
    "articleShowsHeading": true,
    "coverKeyStored": true,
    "categoryStored": true,
    "bothTagsStored": true,
    "noConsoleErrors": true
  },
  "tagSlug": "performance",
  "secondTagSlug": "blogging"
}
```

步骤：注册 → `/settings/admin/posts/new` → 填标题/slug/分类/两个标签/摘要 → 编辑器里敲正文（`## ` 小标题）→ 浏览器直传封面 →
创建草稿 → 点「发布」→ 打开 `/taxonomy/category/frontend` 与 `/taxonomy/tag/performance` 两个前台页，都能看到这篇文章的链接 →
打开 `/posts/<slug>` 看到正文标题。

为不污染开发库，脚本**复用**站点已有的分类与标签（`frontend`、`performance`、`blogging`），结束时删掉自己建的那篇文章；
跑完核对：`posts` 39 / `categories` 7 / `tags` 98 / `post_tags` 122，`h24-*` 残留 0，孤儿关联 0。
截图：`post-editor.png`、`taxonomy-category.png`、`taxonomy-tag.png`、`article.png`。

## 一个跨模块的发现：前台**不渲染文章封面**

写路径与存储这一侧是完整的（`coverKey` 落库、`posts.list`/`posts.bySlug` 都返回它，`media.uploads` 直传可读），
但**前台没有任何页面渲染文章封面**：`apps/web/src` 里 `MediaImage` 只被 `albums` / `toolbox` 使用，
`/article`、`/posts/[slug]`、`/taxonomy/**` 的卡片都没有图片。这是 H17/H23 交付的前台页面缺口，不在本任务的写范围内，
所以验收里的「列表页显示封面」这一半**没有做**：数据已就绪，缺的是前台的十来行渲染。

需要的改动很小（每个列表卡片一处）：

```tsx
import { MediaImage } from "#src/components/media-image.tsx";

// 卡片里：
<MediaImage alt={`${post.title} 的封面`} assetKey={post.coverKey} fill />
```

`posts.list` 与 `posts.bySlug` 的 `coverKey` 字段都已存在，`MediaImage` 也已支持 key → URL。

## 测试

`packages/api/tests/integration/admin-posts.test.ts` 从 17 例扩到 **25 例**，新增的 8 例覆盖：

- 一次写全（分类 + 两个标签 + 封面 + 精选 + 发布日期）并原样读回，日期落在 `2026-09-01T00:00:00.000Z`；
- 文章能按分类、按标签被公开列表查到；
- 新分类/新标签出现在 `taxonomy.overview` 且 `postCount = 1`；新分类名称默认为 slug；
- 标签**差集**更新：两次同样的更新是幂等的，去掉的标签不再能查到这篇文章；
- 更新省略分类/标签/封面/精选时保持原值；显式 `null` 才清空；
- 删除文章后 `post_tags` 不留孤儿行（直接查库断言）。

## 已知取舍

- 分类与标签只有「写进文章」这一条入口（表单里的自由输入 + upsert）。删除/改名分类或标签还没有界面，
  迁移来的 7 个分类 / 98 个标签已经够用；真需要管理面时再加，不在本次 P0 里。
- `readingMinutes` 仍由迁移数据带着，写路径没有重新估算：正文长度和阅读时长不是这个任务要解决的问题。
- `comment` 开关没进表单（读路径已支持），留待需要时再说。
