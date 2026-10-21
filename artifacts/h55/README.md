# H55 设计系统护栏：证据

## 交付

- scripts/check-design.mjs：三类规则（硬编码设计值 / 包依赖边界 / CSS 单入口），零依赖，Node 原生。
- .github/workflows/ci.yml：verify 作业在 vp check 之后、knip/test 之前运行 pnpm run check:design。
- package.json：新增 scripts.check:design；root + 8 个现有 workspace 包补 license: AGPL-3.0-or-later（components 包由 H54 自带）。
- docs/design-system.md：令牌真源、两个包职责、加组件流程、例外清单、换肤做法。
- scripts/tsconfig.json：allowJs + include mjs，让 .mjs 护栏也进入类型感知 lint（否则 190 条 no-unsafe-* 误报）。

## 脚本规则

### a. 硬编码设计值

扫描 packages/ui/src、packages/components/src、apps/web/src：

- 原始颜色 #hex / rgb() / hsl() / oklch() / lab()；
- 任意值 utility（text-[13px]、w-[56rem] 等）。

输出格式：

    apps/web/src/components/__design-hard-probe.tsx:1:23 hardcoded design value text-[13px] - use a token utility or add an explicit exception to scripts/check-design.mjs
    design check failed: 1 violation(s)

允许例外全部显式且逐条打印 allow ...：令牌样式表、apps/web/src/app/api/og/route.tsx（satori 只能 inline style）、少量待 H53 令牌化的值、响应式外壳几何、全局 layout geometry、令牌表达式。新增例外必须写原因。

### b. 依赖边界

- @hataraku/ui 与 @hataraku/components 的 package.json / 源码不得出现 next、next/*、@hataraku/{api,db,auth}、apps/*；ui 不得依赖 components；
- 所有 packages/* 源码不得 import 到 apps/ 下；
- packages/components 不存在时打印 skip 并以当前可检查部分通过，包出现后自动生效。

### c. CSS 单入口

- 每包最多导出一个 .css entry；ui 的 entry 是 ./globals.css，令牌文件只允许 src/styles/；
- 包内组件不得零散 import .css；apps/web 只允许在 layout.tsx 导入一次 @hataraku/ui/globals.css；
- 额外 stylesheet 文件、额外 css export 均失败。

## 实测

### 故意违规（已删除临时探针，证据在 artifacts/h55/）

硬编码 text-[13px]：

    apps/web/src/components/__design-hard-probe.tsx:1:23 hardcoded design value text-[13px] - ...
    EXIT=1

packages/ui 里 import next/link：

    packages/ui/src/__design-boundary-probe-2.ts:1:13 package boundary: packages/ui imports next/link
    EXIT=1

包内零散 CSS：

    packages/ui/src/components/__design-css-probe.css:1:1 styles: packages/ui has a stylesheet outside the single entry
    EXIT=1

删除后：

    node scripts/check-design.mjs
    design check passed.
    EXIT=0

### 正常状态

- pnpm run check:design → EXIT=0（pass.txt）
- vp check → EXIT=0（276 files formatted，220 files lint/type 全绿）
- CI YAML 解析通过，verify 步骤顺序：
    Format, lint and type check
    Check design-system guardrails
    Look for unused code and dependencies
    Unit and integration tests
    End-to-end tests
    Build
- license 字段：root + apps/{web,server,mobile} + packages/{api,auth,config,db,ui} 共 9 个 package.json 均为 AGPL-3.0-or-later。

### 已知非 H55 阻塞

pnpm exec knip → EXIT=1，报 packages/ui/src/icons.ts 的 13 个 unused exports + 1 个 unused type。该文件是 H53 的在途产物，不在 H55 写范围；H55 自身没有新增未用导出。H53 完成后 knip 才能全绿。

## 延后验收（H54 落地后）

packages/components 出现后，用同一脚本跑真实包边界校验：next/*、@hataraku/{api,db,auth}、apps/* 应 0 命中；届时只做这一步，不重做前面。

## 命令

    pnpm run check:design
    vp check
    pnpm exec knip
