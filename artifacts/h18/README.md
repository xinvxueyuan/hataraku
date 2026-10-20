# H18 · 后台内容写路径 + R2 封面直传

四个写作面（文章、微言、项目、更新日志）现在都能在后台写完直接看前台，封面上传走 R2 预签名直传。
文章写路径是 H14 建的，本次补齐 micro / projects / changelog，并加上对象存储上传。

## 写路径（全部 `adminProcedure`）

沿用 H14 的授权边界：`protectedProcedure` + 站长白名单，规则只在 `packages/api/src/procedures.ts` 一处。

| procedure | 作用 |
| --- | --- |
| `content.micro.adminList / byId / create / update / publish / unpublish / remove` | 微言（纯文本 + 类型 + 标签 + 配图） |
| `content.projects.adminList / byId / create / update / remove` | 项目（状态、排序、精选、封面、Markdown 详情） |
| `content.changelog.adminList / byId / create / update / remove` | 更新日志（版本、日期、变更条目、Markdown 正文） |
| `media.uploads.policy / presign` | 上传策略与预签名 PUT |

三个写面共用的两条规则：

- **slug**：表单可以留空或直接粘中文标题，服务端 `resolveSlug`（`packages/api/src/slug.ts`）统一折叠成 `[a-z0-9-]`；
  中文这种没有 ASCII 可保留的输入回退成 `<前缀>-<YYYYMMDD>-<随机>`，不会写出空 slug。唯一性在写之前用一次查询换成可读的 `CONFLICT`，
  数据库唯一索引仍是最终不变量。
- **正文**：项目详情与更新日志正文走 `assertStorableBody`（与渲染侧 `renderMdx` 同一份 `assertSafeMdx`），命中返回可读的 `BAD_REQUEST`；
  微言正文是纯文本、渲染时按文字输出，没有 MDX 面，所以不需要守卫。

`assertStorableBody` 是这次从 `admin-posts.ts` 提到 `mdx-guard.ts` 的：原来 posts 与 content 各写一遍「把 `UnsafeMdxError` 翻成
`BAD_REQUEST`」的映射，现在只有一份。

## R2 封面上传

**密钥只留在服务端**：浏览器先向 `media.uploads.presign` 要一张票（服务端鉴权 + 校验 + 签名），再拿票把字节 `PUT` 给 R2，
表单里只回写对象 key。R2 的 Access Key 与 Secret 不进入浏览器，也不进入任何返回体。

策略（`packages/api/src/r2.ts`，全部服务端强制）：

- 只接受 `image/avif|gif|jpeg|png|webp`，扩展名**由 MIME 推导**，从不信任上传的文件名；
- 单文件上限 10 MiB（Zod 与签名两侧都带上）；
- key 前缀闭集（`posts/projects/micro/albums/...`），段落白名单化，杜绝路径穿越；
- key 形如 `<prefix>/<scope>/<YYYYMMDDHHMMSS>-<8 位随机>.<ext>`；
- 10 分钟有效期（`X-Amz-Expires=600`），签进 `Content-Type` 与 `Content-Length`。

**上传地址只从环境变量来**：`R2_PUBLIC_BASE_URL` 是必填项，没有写死的 CDN 域名；换域名只改环境变量。
同理，页面里的绝对地址一律从请求推导（本轮新增的代码没有新增任何域名常量）。

### 部署前必须配置

`apps/server/.env`（或部署环境）需要：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`、`R2_PUBLIC_BASE_URL`。
缺任意一项时 `media.uploads.presign` 返回 `SERVICE_UNAVAILABLE`（可读文案），不会签出坏地址。

**R2 桶的 CORS 必须放行站点来源的 `PUT`**（以及 `GET`）。浏览器直传是默认路径：预检通过后，字节从浏览器直接进桶，
服务端只签发那张票。本地跑证据时用的 `http://localhost:3300` 原先不在桶的 PUT 白名单里（v2 也是只放了 3000 端口），
被预检拒过一次；把该来源加进白名单后**真实浏览器直传通过**（见下面证据的 `uploadPath: "browser"`）。换域名/端口时，
记得把新来源同步进桶策略——这是唯一与代码无关的部署前置。

## 页面

`/settings/admin/{micro,projects,changelog}` 各有一个列表页与 `[id]` 编辑页（`new` 为空表单），共用 `AdminPageShell` / `AdminNav`
（四个写作面互相可达）与 H14 的表单样式；项目与更新日志的 Markdown 编辑器仍是 H14 的 `@mdxeditor/editor` 组件。
未登录 → `/login?redirect=…`；已登录但不在白名单 → 渲染 403 块（API 的 `FORBIDDEN`）。

## 证据

```sh
node artifacts/h18/admin-content-journey.mjs http://localhost:3300
```

真机（可见 Chromium，`H18_BROWSER_EXE` 可指向本机 Chrome）在同一个浏览器上下文里：注册 → 新建微言 → 后台列表可见 → 前台 `/micro` 可见；
新建项目 → **浏览器把封面直接 PUT 进 R2** → 保存 → 前台 `/projects` 出现该图并**真实加载成功**；
新建更新日志 → 后台列表可见。结束时把本轮写的三行删掉，本地库不留夹具。

脚本对失败路径也不装作成功：浏览器直传被桶的 CORS 拒绝时，它会用同一张票从测试进程把字节送上去，并把
`coverUploadedFromBrowser` 记成 false（这一轮是 true）。

输出（`exit 0`）：

```json
{
  "browserUploadBlocked": false,
  "checks": {
    "microInAdminList": true,
    "microOnPublicPage": true,
    "coverKeyStored": true,
    "coverOnPublicPage": true,
    "coverLoaded": true,
    "changelogCreated": true,
    "changelogInAdminList": true,
    "noConsoleErrors": true,
    "coverUploadedFromBrowser": true
  },
  "coverKey": "projects/<scope>/<时间戳>-<随机>.png",
  "uploadPath": "browser"
}
```

最后一轮是在 `next build` + `next start` 的生产产物上跑的（不是 dev server），所以没有 HMR 干扰。

`coverLoaded` 为 true 表示浏览器真的把对象从 CDN 拉下来了（`naturalWidth > 0`），不只是 `src` 里有这个 key；
另有独立探测：同一 key 在公网返回 `200 image/png`。截图：`admin-micro-editor.png`、`admin-micro-list.png`、`public-micro.png`、
`admin-project-editor.png`、`public-projects.png`。

## 测试

- `packages/api/tests/integration/admin-content.test.ts`（19 例）：七个写 procedure 对匿名调用一律 `UNAUTHORIZED`；非白名单 `FORBIDDEN`；
  草稿不进公开列表、发布后进；编辑回读；删除两次第二次 `NOT_FOUND`；不安全正文 `BAD_REQUEST`；slug 冲突 `CONFLICT`；
  中文内容生成日期 slug；预签名 URL 的形状（host、key、`X-Amz-Signature`、`X-Amz-Expires=600`）与 `publicUrl` 拼接；
  非图片类型 `UNSUPPORTED_MEDIA_TYPE`；超限 `BAD_REQUEST`；未配置存储 `SERVICE_UNAVAILABLE`。
- `packages/api/src/r2.test.ts`（10 例）+ `slug.test.ts`（9 例）：纯函数的 key 规划、MIME 白名单、scope 清洗、slug 折叠与回退。

## 改动范围说明

字面写范围内：`packages/api/src/routers/content.ts`、`routers/media.ts`、`schemas.ts`、新增 `r2.ts` / `slug.ts` 及其单测、
`apps/web/src/app/settings/admin/**`、`apps/web/src/components/**`、`artifacts/h18/**`。

范围外但必要：

1. `packages/api/package.json` + `pnpm-workspace.yaml` + `pnpm-lock.yaml`：新增 `@aws-sdk/client-s3` 与 `@aws-sdk/s3-request-presigner`（catalog）。
2. `packages/api/src/mdx-guard.ts` / `routers/admin-posts.ts`：把 BAD_REQUEST 映射收进 `assertStorableBody`，避免两个写面各写一份。
3. `apps/web/src/app/settings/admin/posts/page.tsx`：换成 `AdminPageShell`，与其他三个写作面共用同一个页头；标题从「写作后台」改为「文章」。

## 已知取舍

- 微言配图先做单张（`imageKeys` 0 或 1 项）：数据列是数组，前台按数组渲染，多图上传器可以后续单独加，不影响已存数据。
- 微言的 `music` / `images`（历史整串 URL）没有进表单：迁移对账显示 `micro_posts` 源库 0 行，没有历史数据要兼容。
- 项目的 `cover`（旧 JSON 元数据）不回写，只写 `coverKey`；前台 `MediaImage` 优先用 `cover.src`、否则用 key，两条路径都在。
- 更新日志的 `changes` 用「一行一条」的 textarea 编辑，而不是可增删的列表控件：列是 `text[]`，这个形态已经够用且更少状态。
