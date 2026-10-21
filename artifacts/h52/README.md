# H52：posts fixture 同源 + login_attempts 噪音判定

## posts fixture

`packages/api/tests/support/fixtures.ts` 导出了 `RSC_BODY` 常量并用它写入 rsc 文章；`posts.test.ts` 的正文断言改为 `bodyMd: RSC_BODY`，与 fixture 同源。以后改 fixture 正文不会再让 posts 测试失配。
断言意图未变：仍核对返回的 body、category、comment、tags、views。

## login_attempts 判定

不是缺表：migration `20261020083325_needy_barracuda` 创建该表，dev 与最新测试库都有；日志来自 `login-attempts-resilience.test.ts` 故意 drop 表后验证登录不受影响，审计写入的 catch 只打日志（`packages/auth/src/login-attempts.ts`）。属预期噪音，无需另开迁移任务。

## 验证

- `vp test --project integration`：16 files / **185 tests passed**，EXIT=0。
- `vp check`：271 files formatted，217 files 0 errors。
- `pnpm exec knip`：EXIT=0。
