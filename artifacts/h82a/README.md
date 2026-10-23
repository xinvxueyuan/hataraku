# H82a 路由边界：loading 骨架 + error / not-found / global-error

任务 `t75` 的证据目录。生产构建（独立 `distDir=.next-h82a`，验证后已删除）与 dev 各跑一遍。

## 交付物（17 个文件，commit `3d83ba4`，未 push）

- 14 个 `apps/web/src/app/**/loading.tsx`：`blog`、`blog/[segment]`、`blog/archive`、`blog/taxonomy`、`docs`、`docs/[slug]`、`notes`、`projects`、`albums`、`albums/[segment]`、`changelog`、`toolbox`、`about`、`search`
- `apps/web/src/app/error.tsx`、`not-found.tsx`、`global-error.tsx`
- 未触碰 `settings/**`、`toolbox/page.tsx`、`about/page.tsx`、`page.tsx`、`packages/**`

## 骨架（Slow 4G，连续导航）

`skeletons-contact-sheet.png` 汇总 7 张：`blog`、`archive`、`taxonomy`、`docs`、`notes`、`projects`、`albums`（均 1440）。
`stream-report.json`：7 条路由的服务端流式顺序，`hasSkeleton` 与 `skeletonBeforeResolve` 全为 `true`（骨架 chunk 先于内容下发，3–10 个 chunk）。

补测过的导航截图：`skeleton-archive-1440.png`、`skeleton-taxonomy-1440.png`。

## 404

- `not-found-1440.png` / `not-found-390.png`：`/nope` → HTTP 404，站内 404（保留 Header/SiteFooter），搜索框 + 四个入口。

## error.tsx 的验证口径（诚实说明）

任务书要求「临时在公开页抛错 → 看到 app/error.tsx」。我按此做了一次临时路由 `app/h82a-throws/page.tsx`，但该路由不在当时的构建里（404），未能形成证据；随后按要求删除。

之后尝试在不进路由表的前提下注入失败，最终**命中了 `global-error.tsx`**：把 RSC 载荷的根行替换为错误行后，页面渲染出 `global-error.tsx` 的文案与「错误编号」（见 `report-boundary.json` 中 `text` 字段）。截图 `error-1440.png` / `error-390.png` 是**同一轮里最后一次成功页面**（`/blog`）的落盘，**不能**当作 error boundary 的截图。

`app/error.tsx` 现有的证据是**构建期接线**：`apps_web_src_app_error_tsx_*.js` 被编进 server 与 client chunk，并含 `error-boundary`、`错误编号`。运行时渲染未取得独立截图 —— 这一条是已知缺口。

## 门禁（2026-10-23，工作树干净）

| 门禁 | 结果 |
| --- | --- |
| `pnpm run ready` | EXIT=0（`vp check` 323 文件格式 / 264 文件 lint+type 零问题；knip；308 tests；e2e 7/7；两包构建） |
| `check:design` | passed（0 violation） |
| `check:compat` | passed（212 源文件） |

`ready.log` 为完整输出。

## 14 条路由与断点

`report-final.json` + `probe-final.cjs`：14 条路由全部 200，1440 与 390 下 `scrollWidth === clientWidth`；`/nope` 为 404。

## 说明

`global-error.tsx` 自带 `<style>` 与 CSS 系统色（`Canvas`/`CanvasText`/`ButtonFace`/`ButtonBorder`），不依赖令牌与组件。`shadcn/no-inline-styles` 同时拦 style 属性与 `<style>` 元素，因此用一条行内 `oxlint-disable-next-line` 并写明理由，未改 `vite.config.ts`。
