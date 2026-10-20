# H27 · R2 桶 CORS 配置/校验脚本

## 目标

把「上传能否工作」依赖的桶 CORS 从口头前提变成可执行检查：幂等应用、只读校验、来源集合**恰好**匹配、退出码可脚本化。

## 交付

- `scripts/configure-r2-cors.ts`
  - `--check`：只发 `GET`，逐条比对两条规则（公开读 + 上传），允许来源集合与 `R2_UPLOAD_ALLOWED_ORIGINS` **完全相等**；多一个来源（放宽）或少一个（漏配）都算 drift。
  - 默认：仅在 drift 时 `PUT` 整份策略，随后读回校验；一致时打印 `nothing was written`，可反复运行。
  - 退出码：`0` 通过（apply 模式为已应用并读回一致）、`1` `--check` 发现需修复、`2` 配置/网络/API 错误（不写入）。
  - 来源只从 `R2_UPLOAD_ALLOWED_ORIGINS` 读，不写死域名；通配、带 path/query 的条目、非 http(s) 条目一律报错。
  - 凭据只从 `CLOUDFLARE_API_TOKEN`、`R2_ACCOUNT_ID`、`R2_BUCKET` 读，任何输出不包含 token。
  - 开发辅助：`CLOUDFLARE_API_BASE` 覆盖 API 基址，仅 mock 测试使用。
- `README.md`：新增 “Media uploads and R2 CORS” 运维段落（用法、环境变量、退出码、为何上传来源收敛）。

## 实测（真实桶，只读）

命令（token/account 从环境注入，未打印；桶名显式设为站点桶）：

```powershell
$env:R2_BUCKET = 'nightstack-assets'
$env:R2_UPLOAD_ALLOWED_ORIGINS = 'https://www.xinvstar.xyz,https://xinvstar.xyz,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3300,http://127.0.0.1:3300'
node scripts/configure-r2-cors.ts --check
```

输出（`check-real.txt`）：

```text
bucket: nightstack-assets
upload origins (6): ["http://127.0.0.1:3000","http://127.0.0.1:3300","http://localhost:3000","http://localhost:3300","https://www.xinvstar.xyz","https://xinvstar.xyz"]
mode: check (read-only)
current policy: 2 rule(s)
  methods=["GET","HEAD"] origins=["*"] maxAge=86400
  methods=["PUT"] origins=["https://www.xinvstar.xyz","https://xinvstar.xyz","http://localhost:3000","http://127.0.0.1:3000","http://localhost:3300","http://127.0.0.1:3300"] maxAge=3600
expected policy: 2 rule(s)
  methods=["GET","HEAD"] origins=["*"] maxAge=86400
  methods=["PUT"] origins=["http://127.0.0.1:3000","http://127.0.0.1:3300","http://localhost:3000","http://localhost:3300","https://www.xinvstar.xyz","https://xinvstar.xyz"] maxAge=3600
OK: the bucket matches the expected policy (6 upload origin(s))
```

真实桶的另外三条证据：

| 场景 | 退出码 | 输出要点 | 文件 |
| --- | --- | --- | --- |
| 期望集合多一个来源（模拟漏配） | 1 | upload origins: missing "https://extra.example" | `check-extra-expected.txt` |
| 期望集合少一个来源（模拟桶被放宽） | 1 | upload origins: unexpected "http://127.0.0.1:3300" | `check-unexpected-origin.txt` |
| 默认模式，桶已一致 | 0 | OK: the bucket already matches the expected policy; nothing was written | `apply-real-noop.txt` |

## 实测（mock API，覆盖写入与幂等）

`artifacts/h27/mock-cors-server.mjs` 是一个最小的 R2 CORS API 替身，把每次请求写入日志，用于在不碰真实桶的情况下验证 apply 路径。

| 场景 | 退出码 | mock 请求序列 | 结论 |
| --- | --- | --- | --- |
| `--check` 对漂移策略 | 1 | GET | 只读：没有 PUT |
| apply 漂移策略 | 0 | GET, PUT, GET | 一次 PUT + 读回一致 |
| 紧接着再 apply | 0 | GET | 幂等：没有第二次 PUT |
| apply 后 `--check` | 0 | GET | 稳定 |
| 桶无策略：`--check` | 1 | GET | 报 the bucket has no CORS policy |
| 桶无策略：apply | 0 | GET, PUT, GET | 建立策略并读回 |
| API 返回非 JSON | 2 | GET | the API returned a non-JSON body (HTTP 200) |
| 未知参数 | 2 | — | 只接受 `--check` |

配置校验（均退出 2，且不发起请求）：缺 `R2_UPLOAD_ALLOWED_ORIGINS`、缺 `CLOUDFLARE_API_TOKEN`、来源含通配、来源带 path。

PUT 请求体（mock 记录）与期望一致：

```text
put rule1: methods=GET/HEAD origins=* maxAge=86400
put rule2: methods=PUT origins=http://127.0.0.1:3000/http://127.0.0.1:3300/http://localhost:3000/http://localhost:3300/https://www.xinvstar.xyz/https://xinvstar.xyz maxAge=3600
```

## 环境发现（重要）

共享的 `C:/dev/env.toml` 里 `R2_BUCKET = 'astrbot-memes'` 是**另一个项目**的桶（该桶没有 CORS）；站点实际使用的桶是 `nightstack-assets`（v2 的默认桶，当前 CORS 即手工配置于此）。因此脚本**不设桶名默认值**，运行前必须显式提供部署自己的 `R2_BUCKET` —— 用错桶会失败而不是静默改错对象。

## 门禁

- `vp check scripts README.md artifacts/h27/README.md`：通过（格式 / lint / 类型检查）。
- `vp test`：19 个文件 / 177 个测试通过。
- `knip`：没有把 `scripts/configure-r2-cors.ts` 列为 unused file，说明 root 的 `scripts/**/*.ts` entry 识别到了它。
- `pnpm run ready`：**未通过**，但红点全部是**他人未提交改动**，在本任务写范围（`scripts/**`、`README.md`、`artifacts/h27/**`）之外，且随并发任务推进而变化：
  - 第 1–2 次：`vp check` 报 `apps/web/src/app/settings/admin/posts/[id]/page.tsx`（工作区 M）格式未整理；`knip` 报 `packages/api/src/schemas.ts` 的 `publishedDateSchema` 未被使用（工作区 M）。
  - 第 3–5 次：格式已由对方修好（232 个文件全绿），新的红点是 `packages/api/tests/integration/admin-posts.test.ts:306` 的 `vitest(prefer-strict-equal)`（对方未提交的测试改动）。
  - 第 6 次：`vp check`、`knip`、`vp test` 全部通过，停在 e2e：`tests/e2e/app.e2e.ts > a wrong password is rejected` 找不到文案 `Invalid email or password`——对方正在改 `apps/web/src/components/auth-form.tsx` 与登录页的错误提示，属其未提交改动。
  - `vp run build` 曾因另一个 `next build` 并发占用而失败（Another next build process is already running）。
  每次尝试的原始输出在 `gate-ready*.txt` / `gate-build.txt` / `gate-test.txt`。待 H24/H25/H26 落地后重跑 `pnpm run ready` 即可；本任务自身文件不构成任何红点。

## 文件

- `scripts/configure-r2-cors.ts`（新增）
- `README.md`（新增 “Media uploads and R2 CORS” 段落）
- `artifacts/h27/`：`README.md`、`check-real.txt`、`check-extra-expected.txt`、`check-unexpected-origin.txt`、`apply-real-noop.txt`、`mock-*` 日志与场景输出、`mock-cors-server.mjs`、`gate-*.txt`
