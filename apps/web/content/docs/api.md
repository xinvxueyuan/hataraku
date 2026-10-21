---
title: API 使用指南
description: 夜行栈公开只读 API：端点、调用方式、跨域边界、错误码与规范文档入口。
section: 集成
order: 10
updatedAt: 2026-10-21
---

# API 使用指南

夜行栈对外提供一份**公开只读** HTTP API，面向第三方与外部工具。站内页面、后台与未来手机端走的是另一条第一方通道，不属于本文档承诺的对外契约。

## 两条通道的边界

| 使用方                 | 通道                         | 是否对外契约           |
| ---------------------- | ---------------------------- | ---------------------- |
| 站内 Web（同源）       | oRPC（进程内 / 同源 `/rpc`） | 否                     |
| 手机端（第一方，未来） | oRPC over HTTP（`/rpc`）     | 否，仅第一方客户端使用 |
| 第三方 / 外部消费者    | OpenAPI（`/api/*`）          | 是，本文档只描述这一面 |

oRPC 是站内与第一方客户端的通道；它的调用方式与示例不构成对外承诺，也不在本文档中给出。外部消费者请只使用下面的 OpenAPI 面。

## 规范文档

- 参考 UI：`/api`
- OpenAPI 3.1 文档：`/api/openapi.json`（`/api/spec.json` 等价）
- 文档只包含对外公开的读接口；后台管理与写接口不在其中。

## 基础地址

部署域名由站点配置决定，本文不写死域名。规范文档的 `servers` 由站点配置的 origin（`BETTER_AUTH_URL`）推导；未配置时回退到请求的 host，形如：

```text
GET <当前站点 origin>/api/...
```

## 能调什么

全部为 `GET`，无需鉴权。参数以规范文档为准。

| 路径                         | 用途                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/api/health`                | 服务健康检查                                                                                                 |
| `/api/posts`                 | 分页列出已发布文章（`page`、`pageSize`、`categorySlug`、`tagSlugs`、`featuredOnly`、`orderBy`、`direction`） |
| `/api/posts/{slug}`          | 按 slug 读取文章                                                                                             |
| `/api/posts/{slug}/adjacent` | 相邻文章                                                                                                     |
| `/api/posts/{slug}/related`  | 相关文章（`limit` 1–10，默认 3）                                                                             |
| `/api/taxonomy`              | 分类与标签总览                                                                                               |
| `/api/taxonomy/categories`   | 分类及文章数                                                                                                 |
| `/api/taxonomy/tags`         | 标签及文章数（`minCount`、`orderBy`）                                                                        |
| `/api/search`                | 全文搜索（`q`、`page`、`pageSize`）                                                                          |
| `/api/site`                  | 站点资料                                                                                                     |
| `/api/micro`                 | 微言列表                                                                                                     |
| `/api/projects`              | 项目列表（`status`、`featuredOnly`、分页）                                                                   |
| `/api/projects/{slug}`       | 项目详情                                                                                                     |
| `/api/changelog`             | 更新日志（`highlightOnly`、分页）                                                                            |
| `/api/friends`               | 友链                                                                                                         |
| `/api/skills`                | 技能                                                                                                         |
| `/api/tools`                 | 工具（`category`、`featuredOnly`、分页）                                                                     |
| `/api/albums`                | 相册列表（`tag`、分页）                                                                                      |
| `/api/albums/{slug}`         | 相册与照片                                                                                                   |
| `/api/devices`               | 设备                                                                                                         |
| `/api/diary`                 | 日记（`tag`、`from`、`to`、分页）                                                                            |
| `/api/timeline`              | 时间线（`category`、分页）                                                                                   |

分页接口返回 `{ items, page, pageSize, total, totalPages }`；时间字段是 ISO 8601 字符串。

## curl 示例

```bash
BASE="https://<当前站点域名>"
curl "$BASE/api/posts?page=1&pageSize=5"
curl "$BASE/api/posts/<slug>"
curl "$BASE/api/search?q=限流"
curl "$BASE/api/taxonomy"
```

## 跨域（CORS）

- 公开只读端点（上表与规范文档）允许任意源的 `GET` 与 `HEAD`；预检 `OPTIONS` 只公布 `GET, HEAD, OPTIONS`。
- 写请求、后台接口与 `/api/auth/*` 不返回跨域许可。
- 第一方通道 `/rpc` 不向网页开放跨域；原生 App 走 HTTP 不受浏览器 CORS 限制。
- 公开数据不携带凭证，因此允许任意源，且不返回 `Access-Control-Allow-Credentials`。

## 错误码

| 状态码 | 场景                                 |
| ------ | ------------------------------------ |
| 200    | 成功                                 |
| 400    | 参数不合法（分页越界、类型不匹配等） |
| 404    | 路径或资源不存在（含未公开的路径）   |
| 500    | 服务端错误                           |

错误响应体是 oRPC 的标准错误 JSON，含 `code` 与 `message`；字段以实际响应为准。

## 限流

公开只读 API 目前没有站点级限流。认证端点由 Better Auth 的限流机制保护，不属于本文档描述的公开 API。

## 缓存与更新

规范文档在服务进程内缓存，不随每次请求重新生成；代码或路由元数据变化在部署（或本地开发热更新）后生效。数据库内容变化不影响文档本身。
