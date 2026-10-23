# H84：登录回跳白名单

## 改动

- `login/page.tsx` 从精确 Route 数组改为段前缀白名单：`/` 精确、`/todos` 与 `/settings` 及其子路径；
- 先规范化再判断：拒绝 `//host`、`http(s):`、反斜杠、`..`、数组/空值；用 WHATWG URL 校验 origin 与 pathname；非白名单回落 `/todos`；
- 保留 `Route` 类型：运行时 type guard 检查通过后才收窄；
- settings layout 的 login target 透传实际 pathname，使 API new/动态 id 回到自身。

## 验证

4 条未登录 307、9 条登录后回原页、5 条开放重定向反例全部回落，ready/design/compat/knip/e2e 见 `evidence.txt`。
