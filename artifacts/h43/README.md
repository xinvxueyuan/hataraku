# H43：/docs 文档站（侧栏 + TOC + 富文本）

## 落地方式（用户确认 A：就地升级）

- 路由仍是 `/docs` 子路径，没有独立应用、没有第二个构建、没有 rewrite；
- 内容只来自 `apps/web/content/docs/**`（Velite `Doc` 集合），正文走与应用文章相同的 `renderMdx` 管道；
- 新增一篇文档 = 加一个 `.md` + `pnpm run typegen`，不碰数据库、不需要后台登录；边界写在 `content/docs/README.md`。

## 版式

- `app/docs/layout.tsx`：左侧分区侧栏（`section` 分组、`order` 排序、`aria-current`）+ 内容列；根布局给博客的是 `max-w-2xl` 阅读列，docs 用 full-bleed 段落自己居中到 `max-w-6xl`（无横向溢出，实测 1440/390 scrollWidth ≤ innerWidth）。
- `app/docs/[slug]/page.tsx`：面包屑、正文、右侧 TOC（`aria-label=本页目录`）、上一篇/下一篇。
- 移动端 `docs-sidebar.tsx` 复用 H39 的 `useDisclosure`：外部 pointerdown / Escape（焦点回 summary）/ 路由（pathname key）/ 选中项，四条关闭路径与头部菜单同一实现。

## 富文本能力（对文章同样生效，均为新增）

- **TOC 与锚点同源**：`lib/markdown/headings.ts` 的 rehype 插件在 `rehypeSlug` 之后从渲染树收集 id，`renderMdxWithToc` 一次编译同时返回内容与目录；`renderMdx` 保持原签名，文章页不感知。
- **容器提示**：`lib/markdown/admonitions.ts` 在编译前把 `:::note|tip|warning|danger [title]` 展开为 `<Admonition>`（组件在允许列表内，仍不执行字符串）；围栏代码里的 `:::` 不展开，未闭合块在文末收尾。旧内容无指令时原样通过。
- **代码块**：`pre` 映射到客户端 `CodeBlock`，保留 Shiki 双主题输出，右上角复制按钮 + `aria-live` 成功反馈。

## 验证

- 5 篇文档的侧栏 5 项、TOC 链接与标题 id 逐一相等（脚本自证，见 evidence.txt）；
- 四种容器暗/亮对比度 8.6–12.41，全部 ≥4.5；
- 旧文档正文文本与标题 id 不变；`content-model` 去除复制 UI 后 HTML 完全相等；
- 移动抽屉四条关闭路径真点击通过；
- `pnpm exec e2e run` 7/7；`pnpm run ready` EXIT=0（完整 `vp check` 含 fmt）。

## 未做（明确拒绝）

- 不引入 KaTeX / Mermaid：本轮没有公式与图渲染需求，加依赖会增大客户端与构建面；确有需求时先讨论。
- TOC 滚动高亮未做（任务标注可选）：它需要 IntersectionObserver 维护第二个「当前标题」状态，锚点本身已可用。
