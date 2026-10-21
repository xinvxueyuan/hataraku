# H66：id-or-slug 寻址与后台别名

## 模型

- 有别名 → `/<module>/<slug>`；无别名 → `/<module>/<id>`。
- 数字段按 id 解析；其它按 slug；`slugOnly + 数字` 由 API 返回 NOT_FOUND，页面 `notFound()`，不重定向、不提示。

## 收敛

`apps/web/src/components/content-path.ts` 导出 `contentSegment` / `contentPath`，是唯一地址计算点；首页、/blog、归档、taxonomy、相册、sitemap、rss、atom、llms、llms-full、OG metadata、搜索结果、后台列表均改用 `contentPath`。

## 后台

文章编辑器把 slug 改为「别名（可选）」，增加「仅别名可访问」开关（空别名时禁用并说明），并实时显示最终地址；保存后预览仍准确。相册没有后台写接口，未虚构编辑器。

## 验证

三组夹具（无别名 / 有别名 / 仅别名）实测 200/404，保存后台开关后复测通过，测后清理；证据见 `evidence.txt` 与 `h66-editor-1440.png` / `h66-post-1440.png`。
