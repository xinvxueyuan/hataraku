# H68 · 三篇仍然渲染失败的文章：只改内容，不放宽守卫

H67 修掉守卫对代码块的误伤后，生产 12 篇里 9 篇恢复；剩下这三篇是**内容本身**触到了 MDX 的边界。
本轮不动 `packages/api/src/mdx-guard.ts`，也不动 `apps/web/**`，只改数据库里的 `posts.body_md`。

## 根因（实测，不是推断）

| id | 标题 | 原因 |
| --- | --- | --- |
| 2 | 在帖子中包含视频 | `::video{provider=…}` 是旧站的指令语法，本仓库的 MDX 管线只有 `remark-gfm`，没有 directive 插件；`{…}` 被当成 JS 表达式，acorn 直接报错 |
| 7 | Markdown 教程 | MDX 把 `<http://example.com/>`、`<address@example.com>` 当 JSX 标签（`/` 在标签名位置非法）；另外**MDX 不把「以 `<` 开头的缩进行」当代码块**——实测 `    <div class="footer">` 会被解析成标签 |
| 30 | JavaScript 模块化演进史 | 散文里的 `require()` 命中守卫的拒绝名单（`\brequire\s*\(`）；同一段里还有 `{}`，会被当表达式 |

守卫会先剥掉围栏代码、缩进代码与**行内代码**再匹配，所以「把代码片段包成行内反引号」既满足安全边界，也不需要放宽任何规则。

## 改动（每篇 2 处起，均为标点/反引号/转义，行数不变）

### id 2 · 在帖子中包含视频（2 行）

```diff
15:
- ::video{provider="youtube" id="5gIf0_xpFPI"}
+ `::video{provider="youtube" id="5gIf0_xpFPI"}`

19:
- ::video{provider="bilibili" id="BV1fK4y1s7Qf"}
+ `::video{provider="bilibili" id="BV1fK4y1s7Qf"}`
```

这两个 ID 出现在「如何使用视频指令」的说明里（同文上方本来就有一段 yaml 示例），包成行内代码后与上下文一致。

### id 7 · Markdown 教程（13 行）

自动链接（Preview 段，行首 `<>`）：
```diff
911: - <http://example.com/>      + [http://example.com/](http://example.com/)
913: - <address@example.com>      + [address@example.com](mailto:address@example.com)
```

缩进代码样例里以 `<` 开头的行（MDX 会当标签）：
```diff
457: -         <div class="footer">      +         \<div class="footer">
459: -         </div>                   +         \</div>
465: -     <div class="footer">          +     \<div class="footer">
467: -     </div>                       +     \</div>
694: - [foo]: <http://example.com/> …    + [foo]: \<http://example.com/> …
903: -     <http://example.com/>        +     \<http://example.com/>
905: -     <address@example.com>        +     \<address@example.com>
978-982: <table>/<tr>/<td>/</tr>/</table> 全部加 `\`
1009-1013: <span>/<div>/</div> 全部加 `\`
```

**没有**动的是真正的 HTML 预览块（行首无缩进的 `<table>…</table>`、`<span>…</span>`、`<div>…</div>`）——那是合法的 JSX，本来就能编译。

### id 30 · JavaScript 模块化演进史（2 行）

```diff
9:
- …命名空间前缀（如 var app = app || {}）来避免冲突…
+ …命名空间前缀（如 `var app = app || {}`）来避免冲突…
19:
- Node.js 采用的模块规范。require() 同步加载…
+ Node.js 采用的模块规范。`require()` 同步加载…
```

## 证据

本机（docker `hataraku-db-1`，库 `hataraku`，39 篇同内容副本）+ `next dev`（:3300，进程内直接调 router）：

```
blog/2  => 200  bytes=63307
blog/7  => 200  bytes=204987
blog/30 => 200  bytes=64296
```

页面里不再出现 `error compiling MDX` / `UnsafeMdxError`；整篇正文用与应用相同的 `@mdx-js/mdx` + `remark-gfm` 编译通过（`node artifacts/h68/diagnose.mjs` 的整篇编译为 ok）。
守卫未改：`git diff` 里没有任何 `packages/**` 或 `apps/**`。

本地把 `apply-production.sql` 直接跑了一遍（幂等验证文件本身可执行）：`UPDATE 1` × 3。

```
pnpm run check:compat → compatibility check passed: 176 source file(s), no compatibility code outside the module. (exit 0)
```

## 生产执行（由 lead 跑，我不连生产库）

```bash
cd C:/dev/dsh/projects/hataraku
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/h68/apply-production.sql
```

预期输出：`UPDATE 1` 三行（每条按 id 定位，正文整体替换，`updated_at = now()` 一并更新）。

跑完验证（只读）：

```sql
select id, length(body_md) from posts where id in (2, 7, 30) order by id;
-- 期望 2 → 277、7 → 11594、30 → 740（与本地一致）

select id, position('\<div' in body_md) > 0 as escaped from posts where id = 7;  -- true
```

然后访问 `https://<站点>/blog/2`、`/blog/7`、`/blog/30`，三篇都应为 200 并正常渲染。

## 复现顺序（脚本就是当时实际跑的序列，都在本地库上）

```bash
node --env-file=apps/server/.env artifacts/h68/fix-bodies.mjs            # 三篇的第一处：反引号 / 链接
node --env-file=apps/server/.env artifacts/h68/patch-7-placeholders.mjs  # id 7：<code goes here> 占位符
node --env-file=apps/server/.env artifacts/h68/patch-7-escape.mjs        # id 7：缩进样例里的 < 转义（可重复跑）
node artifacts/h68/diagnose.mjs artifacts/h68/body-7.after.md            # 整篇编译自检
node --env-file=apps/server/.env artifacts/h68/make-diff.mjs             # 重新生成 diff-<id>.txt
node --env-file=apps/server/.env artifacts/h68/make-sql.mjs              # 重新生成 apply-production.sql
```

前两个是**一次性**的（正文已经改过，再跑会在断言处停下并告知第几行对不上），`patch-7-escape.mjs` 幂等、可重复执行。

## 已知取舍

- id 7 里这些缩进样例被转义后，MDX 会把它们当**段落文本**渲染（浏览器里显示 `<div class="footer">` 这样的字面量），而不是代码块。这是 MDX「以 `<` 开头的缩进行不当代码」的直接后果；要恢复代码块外观需要把这几段改成围栏代码块（会增行、动结构），超出本轮「最小语义变更」的授权，建议另开一条内容任务。
- id 2 的两行现在是行内代码，读者能看到语法但不会真的嵌入视频：当前管线没有 directive 支持，这是不改代码前提下最接近原意的表达。
- `updated_at` 被更新：这三篇的 sitemap `lastmod` 会前移，这是内容确实变了的正常结果。
