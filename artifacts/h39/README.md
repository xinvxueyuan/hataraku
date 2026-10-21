# H39：移动「菜单」/ 桌面「更多」的关闭行为统一

## 根因

`nav-links.tsx` 里的 `<details>` 是非受控的，只有 Escape 与 onToggle 处理；全仓没有 outside-click，也没有按 pathname 收起的逻辑。`closePanel` 只在点击链接那一刻改 DOM，无法覆盖「点空白」与「路由变化」；而且直接改 DOM 与 React 状态会打架。

## 实现：一个来源 `components/use-disclosure.ts`

- 受控 `<details open={open} onToggle={...}>`，关闭只有 `close()` 一个入口；`MobileNav` 与 `MoreMenu` 共用同一 hook。
- 四种关闭：
  1. 面板外 `pointerdown`（不是 click；拖拽/滚动不误触）；
  2. 路由变化：组件以 `usePathname()` 作为 key，新路由上 disclosure 以关闭状态重建（无需在 effect 里 setState，避免级联渲染；也覆盖浏览器前进/后退）；
  3. Escape：关闭并把焦点还给 summary；
  4. 面板内链接点击：`close()` 立即收起（覆盖同一路由的链接，pathname 不变的情况）。
- 外部监听仅在 open=true 时挂到 document，`useEffect` cleanup 对称移除；不存在常驻监听。
- 可访问性保持：开时焦点进面板首个链接、Escape 回焦点、受控 details 保留原生展开语义；summary/菜单文案未改。

## 验证（真点击，非 JS 派发）

- 390：空白点击 / 文章链接 / Escape / 面板内链接 四情形均收起，URL 与 activeElement 已记录；
- 1440：桌面「更多」同样四情形通过；
- 泄漏：连续 3 次开关，pointerdown+keydown 的 add=6/remove=6，net=0；
- `pnpm exec e2e run` 7/7；`pnpm run ready` EXIT=0；`vp check`（含 fmt）2 文件 0 error。

## 文件

- `apps/web/src/components/use-disclosure.ts`（新）
- `apps/web/src/components/nav-links.tsx`（改用 hook；移除旧 disclosureHandlers/closePanel）
- `artifacts/h39/**`
