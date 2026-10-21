# H61：中文两行标题行高修复

## 根因

首页 lead 标题用 `text-2xl`（24px）时，Tailwind 的默认行高是 32px（1.333）；中文两行标题视觉上挤。h1 在桌面 `text-5xl` / 移动 `text-4xl` 的默认行高分别是 48px（1.0）与 40px（1.111），比 lead 更紧。

## 修复

- 首页 h1：`leading-tight`（1.25，桌面 48→60px，移动 36→45px）；
- 首页 / `/article` 的 lead 标题：`leading-normal`（1.5，24→36px）；
- `/article` h1：`leading-tight`（30→37.5px）；
- 文章页 h1 保持 1.2（未低于阈值），正文 h2 1.333、区块标题 1.429、普通卡片 1.556 均未动。

只用了标准 leading 工具类，没有任意值；`check:design` 通过。

## 验证

见 `evidence.txt` 与 `before.json` / `after.json`；截图 before/after（1440 + 390）在 `artifacts/h61/`。
