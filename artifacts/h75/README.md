# H75：搜索结果元信息

## 改动

- 结果项新增一行元信息：分类（categorySlug，链接分类筛选）、发布日期、阅读分钟数；标签以 `#tag` 小号文本展示最近 3 个，其余显示 `+N`，不做 chip；
- 元信息与 `/blog` 列表统一 `text-xs text-muted-foreground`；标题保持 `text-lg`，摘要/片段仍为次要文本；
- 字段全部来自 H73 已返回的搜索结果，没有新增请求。

## 验证

Goo/限流/Markdown 三组计数、抽样字段、390 无溢出、ready/design/compat/knip/e2e 见 `evidence.txt`；前后截图 6 组。
