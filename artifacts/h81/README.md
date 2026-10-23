# H81：新建 API 令牌五步向导

## 流程

`/settings/api/new?step=1..5`：名称 → 作用域 → 有效期 → 复核 → 结果。步骤用 History API 同步 URL，外壳保持挂载；已完成步骤可回退，未来步骤不可点；底部固定「上一步 / 下一步」，第 4 步才出现「确认创建」。

## 安全

明文只存在于第 5 步客户端 state，不进 URL/storage；刷新第 5 步降级为「令牌已创建，请回列表」；离开结果页前 role=alertdialog 二次确认；复制按钮 accessible name「复制令牌」。

## 验证

五步全流程、校验禁用、列表 prefix/有效状态、SPA 探针、刷新降级、390 无溢出、ready/design/compat/knip/e2e 见 `evidence.txt`；截图 h81-step*.png（明文为占位符）。
