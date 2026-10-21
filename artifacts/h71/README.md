# H71：门户首屏精修

## 改动

- 海报移除站点名与 hero.title，改为「四类内容计数 + 作者对档案的说明 + 最新写作」；
- 删除 `NIGHT STACK · PORTAL` 眉标；右侧 h1 成为唯一主锚；
- 主数字 72px → 桌面 36px / 移动 30px，改为次级信息；
- 文案「篇写作」→「篇文章」；
- 海报改为按内容高度结束（grid items-start），不再被右侧拉伸制造中段空洞。

## 验证

portal main 内站点名 2→1、`PORTAL` 1→0；海报 386→344px，中段最新块间距 20px；移动端无横向滚动。`pnpm run ready` EXIT=0，e2e 7/7。详见 `evidence.txt` 与 before/after 截图。
