# H46 · 可配置的站点统计（analytics）

站点此前**完全没有**统计埋点。这一轮加的是「站长在后台配置一个第三方统计服务」：可开可关、填站点 ID、
默认关闭；只有正式构建、且开关打开、且配置合法时，页面才会出现那一个脚本标签。

## 数据模型（新迁移）

`site_profile.analytics`（jsonb，NOT NULL，带默认值）：

```json
{ "enabled": false, "provider": "none", "respectDnt": true, "scriptSrc": "", "siteId": "" }
```

- 列用完整默认对象而不是 `NULL`：老行读出来就是「关闭」，不是「未知」；
- `respectDnt` 默认 **true**：访客声明了 DNT 就默认不跟踪，除非站长主动关掉这个开关；
- 迁移：`20261021110937_large_morph`，只有一句 `ALTER TABLE site_profile ADD COLUMN analytics ...`。

### 迁移链的一次修复（重要）

第一次 `db:generate` 生成了 `CREATE TABLE two_factor` —— 不是新需求，而是**快照链断了**：
`20261020085105_wonderful_swordsman` 已经建过 two_factor（含 `user.two_factor_enabled`），
但紧接着的手写迁移 `20261020090000_search_index_fulltext` 的 `snapshot.json` 里没有它，
于是之后每次 generate 都把它当新表重发 —— 这份迁移会在**任何已跑过 good 版本的库**上 `42P07 重复建表`（本地/测试库立刻复现）。

修法：把 two_factor 的 15 条 ddl（表、列、索引、主键、外键 + user 的那一列）从上一版快照**原样搬回**
`search_index_fulltext/snapshot.json`（SQL 一字未改，只补 ddl 记录），再重新 generate。现在新迁移只有 analytics 一句。

生产（Neon）的记录与实际不符（5 条迁移已记录，但 `to_regclass('public.two_factor')` 为 null）——
那条缺口需要一条**幂等修复迁移**（`CREATE TABLE IF NOT EXISTS …`）单独处理，已由 lead 拆成 H48，不在本轮。

## 校验（zod）

- `provider` 必须在枚举内：`none | umami | plausible | google | custom`；
- `siteId`：trim 后 ≤80，只允许 `[A-Za-z0-9._:-]`；
- `scriptSrc`：空，或 **https** URL。`javascript:` / `data:` / `http:` 全部在协议检查上被拒；
- 交叉校验：`custom` 必须给 `scriptSrc`；`umami`/`plausible`/`google` 必须给 `siteId`。

读侧故意宽松（`scriptSrc`/`siteId` 只是字符串）：手工改库的脏值不该让 `site.profile` 整个读不出来，
真正的把关在注入器里（下面），那是最后一道。

## 注入

- `site-analytics-settings.ts`：**纯函数** `resolveAnalyticsScript(settings)` —— 关闭、`none`、缺 siteId、
  非 https 源全部返回 `null`；单元测试 7 例把这个矩阵钉住。
- `site-analytics.tsx`（client）：拿上面的结果渲染**一个** `<script async>` 元素；
  站点 ID 作为 `data-website-id` / `data-domain` / `data-site-id` 属性传，**从不拼 HTML**。
  用原生元素而不是 `next/script`：后者在 App Router 下**不会**把标签放进服务端 HTML（只发 preload + 一段 hydration 时才加载的引导脚本），
  而统计标签本就该是文档的一部分、不必等 React 水合 —— 原生 `async` 元素两个要求都满足。
- `site-analytics-mount.tsx`（server）：读配置再交给上面那个组件；layout 因此保持同步，只挂一行。
- **只读一次**：`loadSiteProfile` 用 React `cache` 包住，layout 的这次读取与 header/metadata 共享同一次查询。

### 两个「不注入」的判据

1. **环境**：`process.env.NODE_ENV === "production"`（构建期内联）。`next dev` 因此不注入，**e2e 跑在 dev 栈上，所以也不注入** ——
   开发者的本机访问不会被算进站长的统计数据。
2. **DNT**：`useSyncExternalStore` 读 `navigator.doNotTrack`，服务端快照取「必须尊重」；
   当 `respectDnt` 为真且浏览器声明 DNT 时，组件不渲染标签。
   代价要说清楚：**尊重 DNT 时标签只在浏览器回答之后才挂载，因此不在服务端 HTML 里**（先渲染再撤下就等于已经发了请求）。
   所以「HTML 里有且只有一个标签」这条证据是用 `respectDnt: false` 的配置取的 —— 那是唯一会出现在 HTML 里的状态。

## 后台 UI

`/settings/admin/profile` 新增「站点统计」区块：服务下拉、站点 ID、脚本地址（仅 custom 用，只收 https）、
启用开关、尊重 DNT 开关，以及一段隐私说明（启用后第三方会收到页面地址/来源/设备等信息，本站不代理也不过滤）。
复用既有的 `FormActions`/`FormFailure`、`Input`/`Label` 与错误映射。

## 测试

- `apps/web/src/components/site-analytics-settings.test.ts`（**7 例**，纯函数）：关闭但有配置、`none`、缺 siteId、
  umami/plausible/google 的地址、custom 的 https 门槛（`javascript:`/`data:`/`http:`/空）、DNT 透传。
- `packages/api/tests/integration/site-analytics.test.ts`（**11 例**）：匿名写入 `UNAUTHORIZED`、非白名单 `FORBIDDEN`；
  默认关闭、开启 umami 存取一致、**关闭但保留配置**；`javascript:`/`data:`/`http:` 三种脚本地址被拒；
  hosted provider 缺 siteId、custom 缺 https 源被拒；社交链接带站内路径（`/rss.xml`）能原样保存（顺带修的既有缺陷）。

## 证据

```sh
node artifacts/h46/analytics-evidence.mjs http://localhost:3302 http://localhost:3303
```

（生产构建 3302 + dev 3303；脚本先读出原配置，逐状态写入并抓取首页 HTML，结束时把配置恢复原样。）

**8 项断言全 true（exit 0）**：

| 断言 | 状态 |
| --- | --- |
| `defaultInjectsNothing` | 默认（未配置）首页 HTML 里 0 个统计标签 |
| `enabledInjectsOne` | 开启 umami 后**恰好一个**：`<script async data-website-id="…" src="https://cloud.umami.is/script.js">` |
| `enabledTagCarriesId` | 该标签带上了配置的站点 ID |
| `disabledWithConfigInjectsNothing` | **开关关闭但配置还在** → 仍然 0 个 |
| `javascriptUrlRefused` / `readableError` | `javascript:` 被 400 拒绝，字段级文案是「Use an https URL」 |
| `productionInjectsWhenOn` | 生产构建里开关打开时有且只有一个 |
| `developmentInjectsNothing` | 同一个配置下，dev 服务端 HTML 里 0 个 |

完整输出见 `artifacts/h46/evidence.json`。

## 附带修复（独立编号 H46-F1）

`updateSiteProfileInput.social` 的值原本只接受 http(s) URL，**迁移来的 profile 里 `social.rss = "/rss.xml"`**，
于是后台站点资料表单把读到的行原样提交就 400 —— 功能看着有、实际存不进去。现在该字段接受「http(s) URL 或站内路径」，
与 `hero.ctaHref` 用的是同一条规则（`profileLink`），并有集成测试钉住（站内路径能存、`ftp://` 仍被拒）。

## 已知取舍

- 只支持「一个」统计服务，不做多家并行：`provider` 是单值，换服务是改配置而非叠加。
- Google 走 `gtag.js` + `dataLayer.push`（配置由 effect 推入），不使用内联 `gtag('config')` —— 那需要 `dangerouslySetInnerHTML`，
  与本仓库「0 处」的约束冲突。
- 没有做「统计事件」（自定义事件、转化），只有页面浏览；需要时再加。