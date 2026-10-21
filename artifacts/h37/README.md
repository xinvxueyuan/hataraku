# H37 · e2e harness 在 Windows 上残留 3200/3201 的根本原因与修复

## 现象

跑完 `pnpm run test:e2e` 后，3200/3201 上残留 next server / API server 进程；下一次跑直接 `APP_ALREADY_RUNNING`（exit 3）。已有两次「门禁红」是这么来的假警报。

## 复现与根因（先取证）

1. **直接复现**：用 `E2E_TEST_PORT=3220` 起 `node tests/support/start.ts`，健康后只杀 start.ts 一个 pid（等价于 runner 在 Windows 上停止命令的方式：TerminateProcess，不是信号）：

   ```text
   port 3220 pid=3360  start-server.js   parent=23224
   port 3221 pid=15892 src/index.ts      parent=24024 (dead)
   ```

   进程树：start.ts 24024 → next CLI 23224 → start-server 3360；start.ts 24024 → API 15892。只杀 24024 后两个 server 都活着。

2. **runner 风格复现**（`artifacts/h37/launcher-probe.mjs`：用 runner 的 spawn 选项起 start.ts，再用 `child.kill("SIGTERM")` 停止）：

   ```text
   ready: 3230=200 3231=200
   killed with SIGTERM; exitCode=null signalCode=null
   4s after kill: 3230=200 3231=200
   ```

3. **为什么 handler 不跑**（`sigterm-probe.cjs`）：Windows 上 `child.kill('SIGTERM')` 是 TerminateProcess，Node 不投递信号：

   ```text
   exitCode=null signalCode=SIGTERM
   ```

   所以 start.ts 的 `finally`（原来的 taskkill 清理）根本不会执行。原 harness 的清理逻辑本身没错，错在它只在「信号到达」时运行。

（注：并非每次 e2e 都留下孤儿——某些路径下 runner 的 worker/console 回收会顺带带走进程树，所以问题表现为间歇；但「单 pid 停止命令 + Next fork 出 server worker」的模型决定了它必然可能发生。）

## 修复

- 新增 `apps/web/tests/support/watchdog.ts`：由 start.ts 以 detached 方式拉起，作为栈的 owner：
  - 先起 API server 并等 health，再起 Next dev；
  - 每 100ms 轮询 parent pid：start.ts 被 TerminateProcess 后立刻（`taskkill /pid x /t /f`）杀掉两棵进程树；POSIX 用 `process.kill(pid, "SIGTERM")`，宽限后 SIGKILL；
  - 同样响应 stop 文件（优雅路径），shutdown 幂等；
  - 继承 runner 的 stdout/stderr，`.e2e/server.log` 仍能记录服务日志；
  - 30 分钟自终止兜底，避免 watchdog 自己变成孤儿。
- 修改 `apps/web/tests/support/server.ts`：
  - 不再由 start.ts 直接 spawn server，而是 spawn watchdog，把两条命令的 cwd/args/env 通过 `E2E_WATCHDOG_CONFIG` 传入；
  - `stopAll` 幂等：写 stop 文件 → 等 watchdog 退出（10s 上限，超时则 taskkill watchdog）→ 以 100ms 轮询两个端口直到空闲（10s 上限；超时打印可读 warning，而不是静默继续）→ 删测试库、关 undici dispatcher（`finally` 保证失败路径也执行）；
  - 启动失败（health 超时 / watchdog 提前退出）同样走 `stopAll`。
- `start.ts` 未改（临时调试日志已移除）；`apps/web/tests/e2e/*.e2e.ts` 未改。

## 验收（硬指标）

1. **连跑两次**（`accept-final2.txt`）：两次 exit=0、7 passed；端口在命令退出后 **1.34s / 3.15s** 空闲；无残留 watchdog。
2. **人为失败**（临时把 `Existing todo` 断言改成失败文本，跑完 `git checkout` 还原，spec 无 diff）：exit=1、1 failed / 6 passed；端口 **1.21s** 后空闲；无残留 watchdog。
3. **同一探针修复前后对比**（`launcher-probe.mjs`）：修复前 `4s after kill: 3230=200 3231=200`；修复后 `4s after kill: 3230=free 3231=free`。
4. **门禁** `pnpm run ready`：**EXIT=0**（`gate-ready-final.txt`：e2e 7 passed、vitest 202 passed；build 成功）；门禁结束后 3200/3201 空闲。
5. 完整 `vp check`（含 fmt）通过：watchdog/server 在门禁的 check 阶段通过。

## 并发插曲（诚实记录）

一次两连跑的第一轮以 exit=3 / `APP_ALREADY_RUNNING` 失败（`interference-run.txt`）：3200 被另一个进程占用了约 15s（很可能是另一位成员并发跑 e2e/gate）。占用释放后重跑两连即全绿。本修复不改变 runner 的预检语义，也不会去杀别人的进程；`E2E_TEST_PORT` 仍可挪端口。

## 文件

- 新增 `apps/web/tests/support/watchdog.ts`
- 修改 `apps/web/tests/support/server.ts`
- 证据：`artifacts/h37/`：`accept-final2.txt`、`final2-run-1/2.txt`、`failure-final.txt`、`gate-ready-final.txt`、`launcher-probe-after.txt`、`interference-run.txt`
