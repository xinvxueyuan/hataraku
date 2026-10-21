# 兼容层：边界、声明与移除

兼容路径是**欠下的债**：它只为验证过的外部约束存在，并且必须一眼能看出来、一步能删干净。这条规则由 `scripts/check-compat.mjs`（`pnpm run check:compat`）在 CI 里执行。

## 规则

1. **只为一个已验证的外部约束保留兼容**：已部署的消费方（旧 RSS、外部链接）、持久化格式（旧列/旧行）、分阶段发布。没有真实外部约束时，直接删旧路径，不写兼容模块。
2. **只住一个模块**：应用代码放 `apps/web/src/compat/`，跨包共享放 `packages/compat/`；通过**单一具名入口**导出。不得以 flag、分支、已弃用别名散落在现行代码里——包括注释里的 `compat` / `legacy` / `backward` / `deprecated` / `LEGACY_` 标记。
3. **模块自证**：模块存在就必须有 `REMOVAL.md`（或入口文件头部注释），写明**约束是什么**与**移除条件是什么**。缺任一项，检查失败。
4. **调用点标注**：每处 import 兼容模块的语句，必须在**同一行或上一行**写 `// compat: <它服务的约束>`。缺注释，检查失败并给出行号。
5. **移除 = 删目录 + grep 归零**：`git grep -nE "#compat|#src/compat|@hataraku/compat"` 返回空，才算删干净。

## 正确地引入一处兼容

1. 先写清约束：谁在用它、证据是什么（监控/日志/链接检查/旧客户端版本）。没有证据就不要引。
2. 建模块：`apps/web/src/compat/`（或 `packages/compat/`），一个具名入口，例如 `export { resolveArticleHref } from "./legacy-article-href.ts";`。
3. 写 `REMOVAL.md`：约束 + 移除条件（可观测、可判定，例如"旧 feed 重新发布且链接检查 30 天零命中"）。
4. 在每个调用点写 `// compat: <约束>`，让原因跟着调用走。
5. 跑 `pnpm run check:compat`。

## 正确地移除一处兼容

1. 满足 `REMOVAL.md` 里的移除条件（先核实，不要凭感觉）。
2. 删掉模块目录与所有调用点（连同 `// compat:` 注释）。
3. 跑 `pnpm run check:compat`；再 `git grep -nE "#compat|#src/compat|@hataraku/compat"` 确认归零。

## 检查器做什么

`scripts/check-compat.mjs` 三条规则，零依赖：

- **位置边界**：扫描 `apps/web/src` 与 `packages/*/src`，命中 `compat|legacy|backward|deprecated|LEGACY_` 标记即失败，报 `文件:行:列 + 原因`。标记按"名字片段"匹配（`legacyPostsHref`、`LEGACY_IMPORT` 命中；句子里的 "compatibility" 不命中），引号内的字符串先被掩码（所以 `#compat/x` 这个 specifier 不会被当成标记）。
- **模块自证**：`apps/web/src/compat` 或 `packages/compat` 存在时，必须有 `REMOVAL.md`（或入口文件头部注释），且同时出现约束与移除条件的关键词。
- **导入标注**：`#compat/*`、`#src/compat/*`、`@hataraku/compat`、`./compat/*` 等 import，必须在同行或上一行有 `// compat: <非空说明>`。

**显式 allow 列表**（每次运行逐条打印）：`docs/`（文档解释兼容）、`artifacts/`（历史证据，不是源码）、`AGENTS.md`（规则本身）、`CHANGELOG`（发布历史）、`packages/db/src/migrations/`（生成的 SQL 保留历史命名）、两个兼容模块目录自身。

**临时例外**写在脚本的 `SOURCE_ALLOWLIST`，必须给"文件 + 精确匹配 + 原因"；条目**失效即失败**（不再匹配任何代码时检查会要求删除），所以例外不会变成永久债。当前有一条：`packages/api/src/routers/admin-posts.ts` 里"清理旧 `cover` 列"的注释——H62 删除该列后，这行注释与例外一并移除。

## 命令

```bash
pnpm run check:compat   # 三条兼容规则；失败给文件:行:列
```

CI 里这一步紧跟在 `Check design-system guardrails` 之后运行。
