# H78：/settings/api 令牌管理

## 页面

- 现有令牌：桌面语义化表格 + 移动卡片；名称、prefix、作用域、创建、最近使用、状态（有效/已过期/已吊销）、吊销二次确认；空态「还没有令牌。」；
- 新建：名称、四个作用域 checkbox（文章/微言/项目/更新日志，无文档）、7/30/90/永久；创建后一次性 <output role=status> 明文 + 复制按钮 + 关闭后不可查看提示；
- 用法：API base、发文章/发微言两条可复制 curl、`/docs/api` 链接；
- 导航新增「集成 → API 令牌」；登录 redirectTargets 增加该路径。

## 安全/无障碍

明文只在客户端 state 中，未进 URL/localStorage/sessionStorage；复制按钮有 accessible name；吊销用 alertdialog；表格有 caption/th scope；390 无横向溢出。

## 验证

空态、创建、刷新消失、吊销、登录回跳与 ready/design/compat/knip/e2e 见 `evidence.txt`；截图在 artifacts/h78。
