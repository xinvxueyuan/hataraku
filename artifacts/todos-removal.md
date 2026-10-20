# 待办：删除脚手架 demo 表 `todos`

**状态**：未执行，**本轮（H1 数据层）刻意保留**。
**触发条件**：博客的第一条竖切跑通之后 —— 以 `posts` 为准（列表 + 详情经 oRPC 打到真库、页面渲染、并有一条 e2e）。
**执行方式**：开一个**独立任务**，按下面清单整体删除；不要分批。

## 为什么不在 H1 本轮删

1. **与项目 AGENTS.md 的 tracer bullet 原则冲突**。AGENTS.md 要求 _"Open with a tracer bullet: the smallest end-to-end slice that works, grown in complete layers."_ `todos` 正是当前**唯一一条贯穿全栈的可用参考实现**：Drizzle 表 + oRPC procedure + web 页 + 集成测试 + e2e + mobile 屏，六层齐全。在博客自己的第一条竖切建立之前删掉它，等于拆掉唯一的参照物。
2. **必须动 `apps/mobile/**`，与「mobile 本轮只做占位」冲突**。证据链：`packages/api/src/index.ts` 导出 `todos: todosRouter` → `AppRouter` → `apps/mobile/src/lib/api.ts` 的 `AppRouterClient` → `apps/mobile/src/app/todos.tsx` 直接调用 `api.todos.*`。删掉 router 后该文件立即类型错误，而 **mobile 在 typecheck 门禁内**（`vp check` 实测覆盖 72→80 个文件，`vite.config.ts` 还有专门的 `apps/mobile/**` lint override）。没有 adapter 或别名能绕过，那会违反 AGENTS.md 的「One representation, one execution path」。
3. **e2e 断言是「规格」，改动需要用户批准**。AGENTS.md：_"E2E tests in `apps/web/tests/e2e` are the specification: changing, skipping, or weakening an assertion takes the user's approval first."_ `apps/web/tests/e2e/app.e2e.ts` 有 3 个用例以 `/todos` 为旅程主体。

## 完整 blast radius 清单（逐文件核实）

### 在 H1 写范围内

| 文件                                           | 动作                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/db/src/schema/todos.ts`              | 删除整个文件                                                             |
| `packages/db/src/relations.ts`                 | 摘掉 `todos` 的 import、表映射项、`todos: { user }` 与 `user.todos` 关系 |
| `packages/api/src/routers/todos.ts`            | 删除整个文件                                                             |
| `packages/api/src/index.ts`                    | 摘掉 import 与 `todos: todosRouter` 注册                                 |
| `packages/api/tests/integration/todos.test.ts` | 删除整个文件                                                             |
| `apps/web/src/app/todos/page.tsx`              | 删除整个路由                                                             |
| `apps/web/src/components/todo-list.tsx`        | 删除整个文件                                                             |
| `apps/web/src/components/nav-links.tsx`        | 摘掉 `{ href: "/todos", label: "Todos" }`                                |
| `apps/web/src/app/login/page.tsx`              | `redirectTargets` 去掉 `"/todos"`，兜底改为 `"/"`                        |
| `apps/web/tests/support/api.ts`                | 删掉 `createTodo` 辅助函数                                               |
| `apps/web/tests/support/server.ts`             | 路由清单去掉 `"/todos"`                                                  |
| `apps/web/tests/e2e/app.e2e.ts`                | 改写 3 个用例（**需用户批准**）                                          |

### 需要扩写范围（`apps/mobile/**`，3 个文件）

| 文件                              | 动作                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `apps/mobile/src/app/todos.tsx`   | 删除整个屏（146 行，完整 CRUD）                                   |
| `apps/mobile/src/app/_layout.tsx` | 摘掉 `<Stack.Screen name="todos" options={{ title: "Todos" }} />` |
| `apps/mobile/src/app/index.tsx`   | 改掉 `href={session === null ? "/login" : "/todos"}` 与对应文案   |

### 数据库

| 对象       | 动作                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `todos` 表 | 由 `vp run db:generate` 生成一条新的 `DROP TABLE` 迁移。**不要**改已提交的 `20261020073432_init` —— AGENTS.md 规定已提交的迁移保持生成时的样子 |

## 其他一并处理项

- **login 兜底**：`apps/web/src/app/login/page.tsx` 当前 `redirectTargets = ["/", "/todos"]` 且兜底也是 `/todos`。删除时兜底改为 `/`（Lead 已同意该口径）。
- **文档**：`AGENTS.md` 的 **Protected page** 一节写着「any other redirect value falls back to `/todos`」，需要同步改成 `/`。

## 验证要求（删除任务完成时）

- `vp run ready` 绿（当前基线 7/7、EXIT=0）。
- `vp run knip` 不再报 `todos` 相关的未使用文件/导出/依赖。
- e2e 断言变更已取得用户批准，且改写后的用例仍在验证一条真实旅程。
