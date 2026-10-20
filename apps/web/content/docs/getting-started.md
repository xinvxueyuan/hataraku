---
title: 上手
description: 这个站点由什么组成，以及本地怎么把它跑起来。
order: 1
updatedAt: 2026-10-20
---

## 技术栈

站点是一个 pnpm monorepo：

- `apps/web` —— Next.js App Router
- `apps/server` —— Hono，同时挂 Better Auth 与 oRPC
- `packages/db` —— Drizzle schema 与迁移
- `packages/api` —— oRPC procedure

## 本地运行

```sh
vp install
docker compose up -d db
vp run db:migrate
vp run dev
```

浏览器只访问 web 应用，它的 `/rpc` 与 `/api` 路由把请求转发给 API 服务，所以会话 cookie 是第一方的。
