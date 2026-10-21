# H70 · 把 id 7 退化成段落的缩进样例改回代码块

H68 为了让《Markdown 教程》(id 7) 能编译，把 15 行「缩进 + `<`」样例做了 `\<` 转义 —— 结果是那几段**渲染成段落文本**，
字面显示 `<div class="footer">`。教程里代码示例显示成段落本身就是内容缺陷，这一轮把它们改成**围栏代码块**。

## 改了什么

6 个块、15 行，围栏内一律去掉转义（围栏里的 `<` 不需要转义），缩进原样保留：

| 原行号 | 语言 | 行数 | 内容 |
| --- | --- | --- | --- |
| 457–459 | `html` | 3 | `<div class="footer">` / `&copy; 2004 Foo Corporation` / `</div>` |
| 465–467 | `html` | 3 | 同上（4 空格缩进的版本） |
| 691–694 | `md` | 4 | 链接引用定义的四种写法（`[foo]: <http://example.com/>` 等） |
| 903–905 | `md` | 3 | 自动链接 `<http://example.com/>`、`<address@example.com>` |
| 978–982 | `html` | 5 | `<table>/<tr>/<td>Foo</td>/</tr>/</table>` |
| 1009–1013 | `html` | 5 | `<span>**Work**</span>` 与 `<div>**No Work**</div>`（围栏语言先按 `md` 生成，随后按内容改成 `html`，因为展示的是标签高亮） |

**没有动**这三类：
- 真正行首无缩进的 HTML 预览块（`<table>…</table>`、`<span>…</span>`、`<div>…</div>`）—— 合法 JSX，H68 已确认；
- 其它任何文章（见下面的排查）；
- 正文文字：只加了 12 行围栏标记（6 开 + 6 合），一行文字都没改。

## 证据

本机 docker `hataraku` + `next dev` :3300，同一篇文章先换回 H68 的正文再换成本轮正文，各取一次页面：

| 指标 | H68 正文（改前） | H70 正文（改后） |
| --- | --- | --- |
| `/blog/7` 状态码 | 200 | **200** |
| `<pre>` 数量 | 7 | **13**（+6，正好是新增的 6 个围栏） |
| 段首出现转义标签的 `<p>` 数量 | 5 | **0** |

整篇正文用与应用相同的 `@mdx-js/mdx` + `remark-gfm` 编译通过：`node artifacts/h70/compile-check.mjs artifacts/h70/body-7.after.md` → `compiled: ok, length 11645`。

## 同类排查（全库 39 篇）

`node artifacts/h70/scan.mjs` 的分类规则：
- **problematic** = 4 空格/Tab 缩进 + 行内含未转义的 `<` + 不属于行首无缩进的 HTML 块 → MDX 会当 JSX 解析；
- **htmlBlockChildren** = 缩进但属于某个行首 `<tag>` 开始的 HTML 块 → 合法 JSX。

结果（`artifacts/h70/scan.json`）：

```
id 7  Markdown 教程     problematic: 0    htmlBlockChildren: 3
其它 38 篇              problematic: 0    htmlBlockChildren: 0
```

那 3 处是 Preview 段 `<table>` 块里的子行（993–995），是故意写成 HTML 的，**保持原样**：

```
992: <table>
993:     <tr>
994:         <td>Foo</td>
995:     </tr>
996: </table>
```

也就是说：**除了本轮这 6 个块，全库没有第二篇文章踩到这个模式**。

## 生产执行（由 lead 跑）

```bash
cd C:/dev/dsh/projects/hataraku
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f artifacts/h70/apply-production.sql
```

预期：`UPDATE 1` 一行。文件里只有 1 条 `update posts set … where id = 7;`，正文用 `$h70$` 美元引号（已确认正文不含该标签）。

跑完验证（只读）：

```sql
select id, length(body_md) from posts where id = 7;   -- 期望 11645
select id, (select count(*) from regexp_matches(body_md, '^```', 'gm')) as fences from posts where id = 7;  -- 期望 12（6 开 6 合）
```

然后访问 `/blog/7`：应 200，并且「杂项 / 自动链接」「块级 HTML」几节里的样例显示为**代码块**而非段落。

## 取舍

- 围栏内的样例**保留了原来的 4/8/12 空格缩进**（教程本身在讲缩进，删掉就丢了那层意思），代价是代码块里首列看起来有留白。
- 选 `html` / `md` 按「展示的是标签还是 Markdown 语法」定；第 6 块内容是标签 + 行内 Markdown，选了 `html`。
- `updated_at` 会前移，sitemap 的 `lastmod` 随之更新 —— 内容确实变了。
