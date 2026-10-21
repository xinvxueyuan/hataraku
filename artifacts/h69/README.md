# H69：门户首页（方向 A）

## 结构

- 左侧海报：令牌渐变/色域、写作计数 38、最新写作角标（标题 + 日期）；
- 右侧身份：h1 站点名、tagline/description、最新写作 / 最新文档两个主 CTA；
- 模块瓦片：4 个有内容的模块（写作 / 文档 / 项目 / 相册），使用 `@hataraku/components` 的 `ModuleTile`；
- 其余入口：微言 / 更新日志 / 工具箱 / 归档 / 分类；
- 页脚保留 API 状态胶囊（e2e `Connected`）。

## 数据

`apps/web/src/server/portal.ts` 并行读 6 个已有 procedure，文档来自 Velite；`buildPortalModules` 是纯函数（固定顺序 + count=0 隐藏），测试在 `portal.test.ts`。

## 验证

计数 38 / 6 / 2 / 1（文档现场 6，任务书写 5，多出 deploying 文档）；TTFB 362→227ms；移动端 clientWidth=scrollWidth；`pnpm run ready` EXIT=0；截图 before/after 1440/390。
