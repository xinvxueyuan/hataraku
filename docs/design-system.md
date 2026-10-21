# 设计系统：令牌、包边界与护栏

这篇文档说明「换整套外观不影响业务」在仓库里怎么落地，以及新增组件必须遵守的流程。规则不是口头约定：scripts/check-design.mjs 在本地和 CI 里检查它们。

## 1. 令牌真源

唯一样式入口是 packages/ui/src/styles/globals.css，由 @hataraku/ui/globals.css 导出；应用只在 apps/web/src/app/layout.tsx 导入一次。

这个文件分四层：

1. @theme inline 桥：把语义令牌映射到 Tailwind 命名空间（--color-* → bg-* / text-* / border-_，--radius-_ → rounded-_，--font-_ → font-*）。没有桥的令牌 Tailwind 看不见。
2. 语义令牌 · 亮色：:root 下的 --background、--foreground、--primary、--radius 等，值本身是 oklch(...)。
3. 语义令牌 · 暗色：.dark 用同一组名字换值；下游不知道当前主题。
4. base 层：只放元素默认值，不放应用结构选择器；components 层故意留空（原语用 cva 写 utility，应用才能用 utility 覆盖而不用打特异性战争）。

**改外观 = 只改这个文件里的令牌值**（必要时加一条令牌 + 一条桥）。不改组件、不改应用页面。

## 2. 两个包的职责

    @hataraku/ui         令牌 + primitive + 行为配方（cva recipes）
    @hataraku/components 通用组合组件（只依赖 ui 与 react）
    apps/web             页面与应用布局；可依赖上面两个包

- @hataraku/ui：button、input、card、badge、checkbox、dropdown-menu、label、sonner 等原语，以及 src/lib/recipes.ts 里的 focus/invalid/disabled 行为片段。**禁止**依赖 next/_、@hataraku/{api,db,auth}、@hataraku/components、apps/_。
- @hataraku/components：跨页面复用的组合（例如站点页头、列表骨架）。同样禁止 Next、服务端包与 apps/*；它只能向下依赖 ui。
- apps/web：可以依赖两个包，也可以写只属于本站的布局类；**不能**被任何 package 反向引用。

包边界检查同时读 package.json 和源码 import；源码路径如果指进 apps/ 也会被拒绝。

## 3. 新增组件

1. 先判断层级：这是**原语**（按钮、输入框这类不带业务语义的控件）还是**组合**（带站点语义、由多个原语拼成）？
2. 原语放 packages/ui/src/components，用 cva 写变体，颜色/圆角/字号/阴影只能引用令牌 utility（bg-primary、text-muted-foreground、rounded-lg 等）。行为片段进 src/lib/recipes.ts，不要在组件里另写 ring/opacity。
3. 组合放 packages/components/src，只组合 ui 原语；需要业务数据时由调用方传入，不在组件里请求 API。
4. 只有一处使用的布局留在 apps/web；不要为了「以后可能复用」提前上提。
5. 跑 pnpm run check:design 与 vp check。

## 4. 护栏规则

node scripts/check-design.mjs（CI 里是 pnpm run check:design）检查三类：

### a. 硬编码设计值

扫描 packages/ui/src、packages/components/src、apps/web/src：

- 原始颜色：#hex、rgb()/rgba()、hsl()/hsla()、oklch()、lab()；
- 任意值 utility：text-[13px]、w-[56rem] 这类值类名（选择器/状态变体如 [&_svg]、data-[...] 不算设计值）。

失败输出是「文件:行号 + 命中类名 + 修复建议」，例如：

    apps/web/src/components/example.tsx:12:23 hardcoded design value text-[13px] - use a token utility or add an explicit exception to scripts/check-design.mjs

**允许的例外**（脚本会逐条打印 allow ...，不静默放行）：

- packages/ui/src/styles/globals.css：令牌定义文件，原始颜色本来就该在这里；
- apps/web/src/app/api/og/route.tsx：satori 渲染 1200×630 分享卡，只接受 inline style，没有 Tailwind/CSS 变量管线，因此必须写字面色；
- 已有但待令牌化的少量值（text-[0.8rem]、rounded-[4px]、min-w-[96px]、ring-[3px] 等）：脚本里以「文件 + 精确类名 + 原因」列在 VALUE_ALLOWLIST，H53 负责替换；**不要**在别处复制这些值；
- 响应式外壳的宽度/高度（如 w-[min(56rem,calc(100vw-2rem))]、h-[420px]）：布局几何，不属于视觉主题，按文件+类名显式列在 allowlist；
- 布局几何 utility（grid-cols-[...]、aspect-[...]、min-h/max-h、left、scale 等）全局允许，因为换主题不需要改它们；
- 令牌表达式（bg-[color-mix(...var(--secondary)...)]、rounded-[min(var(--radius-md),...)]）全局允许，因为最终值仍来自令牌。

新增例外必须在脚本里写注释说明原因；没有注释的放行不允许。

### b. 依赖边界

- @hataraku/ui 与 @hataraku/components 的 package.json 和源码不得出现 next / next/_、@hataraku/{api,db,auth}、apps/_；ui 还不得依赖 @hataraku/components。
- 所有 packages/* 的源码不得 import 到 apps/ 下（反向依赖）。
- @hataraku/components 尚未落地时脚本打印 skip: packages/components is not present yet...，并以当前可检查的部分通过；包一出现，同一套规则自动生效。

### c. CSS 单入口

- 每个包最多导出一个 .css entry；@hataraku/ui 的 entry 是 ./globals.css，令牌文件只能放在 src/styles/。
- 包内组件不得零散 import .css；应用只在 apps/web/src/app/layout.tsx 导入一次 @hataraku/ui/globals.css。
- 第三方样式（@mdxeditor/editor/style.css、@univerjs/.../index.css）属于应用运行时依赖，不在包入口规则内。

## 5. 换整套外观

1. 只改 packages/ui/src/styles/globals.css：:root 与 .dark 的语义令牌值；需要新语义时补 @theme inline 桥。
2. 不改 packages/ui/src/components、packages/components、apps/web 的任何类名。
3. 跑 pnpm run check:design 与 pnpm run ready；CI 的 verify 会在 vp check 之后运行设计护栏。

## 6. 测对比度：先确认主题，再读颜色

WCAG 的对比度判定用**计算色**（computed color），不是像素均值，也不是样式表里某条声明的字面值。测令牌相关的颜色时按这个顺序：

1. 走真实 UI 切主题（点主题按钮），或至少等渲染稳定（下一帧之后再读）；
2. **先确认状态**：`document.documentElement.className`、`matchMedia("(prefers-color-scheme: dark)")`，以及目标令牌本身，例如 `getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground")`；
3. 再读 `getComputedStyle(el).color` 与最近**不透明**祖先的 `backgroundColor`，用 canvas 之类把 `lab()`/`oklab()` 解析成 sRGB，再套 WCAG 公式。

**不要**在 `classList.remove("dark")` / `add("dark")` 之后同步读 computed color：样式可能还没重算，而 `.dark` 在 `:root` 之后重定义了同名令牌，此时读到的是**另一主题**的值。真实案例：深色 `--muted-foreground` `oklch(0.70 …)` 放在白底算出 2.67:1，被误报为浅色主题缺陷；等主题稳定后同一处是 **6.02:1**。两个主题的令牌值恰好都"像一个合理的灰"，所以这种误报看起来很像真的 —— 先读令牌值自证主题，是成本最低的防线。

同理，评审工具若从样式表里取"最后一条同名声明"再配一个假定背景，也会得到同样的假阳性；取色必须取**当前主题的 computed color + 实际背景**。

## 7. 本地命令

    pnpm run check:design   # 三类规则；失败给文件:行号
    pnpm run check:compat   # 兼容层边界（规则与流程见 docs/compatibility.md）
    vp check                # 格式 + lint + 类型
    pnpm run ready          # 完整门禁（共享工作树时按团队协作规则执行）
