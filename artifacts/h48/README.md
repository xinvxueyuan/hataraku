# H48 · two_factor 的幂等修复迁移

## 为什么要这一条

`20261020085105_wonderful_swordsman` 建过 `two_factor` 表与 `user.two_factor_enabled`。紧接着的
**手写**迁移 `20261020090000_search_index_fulltext` 的 `snapshot.json` 丢了这批 ddl，于是之后每次
`vp run db:generate` 都把它们当新表重新发一遍 —— 这样的迁移会在**任何已跑过前者**的库上 `42P07` 重复建表。

根因已在 H46 修好（把 15 条 ddl 原样补回那份快照；`db:generate` 现在输出 `No schema changes, nothing to migrate`）。
但**记录层的缺口修不了代码**：一个库只要 `drizzle.__drizzle_migrations` 里记着 `wonderful_swordsman` 跑过了，
drizzle 就永远不会再执行它。于是一个「记录说跑过、表却不在」的库（旧备份恢复、早期版本的迁移文件、迁移中断）
会一直缺表，而**每一次 2FA 绑定都会在第一次写入时失败**。

这条迁移就是给这种库补一次。它**幂等**：表在就什么都不做，表不在就按 `packages/db/src/schema/auth.ts` 的形状建出来。
它只写 SQL，不改 schema —— 所以紧接着的 `db:generate` 依然什么都不生成。

## 生产实测（只读核对，2026-10-21）

生产是 Neon 同分支上的 `hataraku` 库（不是 `neondb`，`NEON_DATABASE_URL` 指向的是后者）：

```
to_regclass('public.two_factor')                                  → 存在
information_schema.columns(user.two_factor_enabled)               → 1 列
drizzle.__drizzle_migrations                                      → 4 条
information_schema.columns(site_profile.analytics)                → 0 列（H46 的迁移尚未上线，预期）
```

**结论：生产不缺 two_factor 表。** 这条迁移在生产上是 no-op，保留它是为了上面那类「记录与实际不符」的库。

## 三种库的实测（`node artifacts/h48/verify.mjs`，10/10 断言 true，exit 0）

| 场景 | 迁移前 | 迁移后 |
| --- | --- | --- |
| **a. 全新库**（`h48_fresh`） | 空 | 6 条迁移；`two_factor` 9 列、1 主键 + 2 索引、外键在；`user.two_factor_enabled` 在 |
| **b. 已含表的库**（dev `hataraku`） | 表在、5 条迁移 | 迁移 exit 0、表与列不变、6 条迁移（**无 42P07**） |
| **c. 模拟生产**（`h48_prodlike`） | 删表 + 删列 + 删最后一条迁移记录 → 表不在、5 条记录 | 跑迁移 → 表、列、索引、外键全部补回；6 条记录 |

**d. 快照链**：`pnpm run db:generate` → `No schema changes, nothing to migrate 😴`，**没有**新目录产生。

## 生产上怎么跑、跑完怎么验

### 跑

```bash
cd C:/dev/dsh/projects/hataraku
# 把生产库地址放进 apps/server/.env 的 DATABASE_URL（该文件在 .gitignore 里），然后：
pnpm run db:migrate
```

预期输出（`apps/server/src/migrate.ts` 走 drizzle 的迁移器，成功时不打印 SQL）：

```
@hataraku/server:db:migrate: $ node --env-file-if-exists=.env src/migrate.ts
 Tasks:    1 successful, 1 total
```

它会先应用 H46 的 `20261021110937_large_morph`（`site_profile.analytics`），再应用本条的 `20261021200000_two_factor_repair`。
两条都是 `ADD COLUMN` / `CREATE … IF NOT EXISTS`，对生产数据无破坏性写入。

### 验（只读）

```sql
-- 1. 迁移记录：应为 6 条，最后一条是本条
select count(*) from drizzle.__drizzle_migrations;

-- 2. 两件事都在
select
  to_regclass('public.two_factor') is not null as two_factor_table,   -- 期望 true
  (select count(*) from information_schema.columns
     where table_name = 'user' and column_name = 'two_factor_enabled') as user_column,  -- 期望 1
  (select count(*) from information_schema.columns
     where table_name = 'site_profile' and column_name = 'analytics') as analytics_column;  -- 期望 1

-- 3. 形状对齐 schema（9 列、3 个索引含主键、1 个外键）
select count(*) from information_schema.columns where table_name = 'two_factor';        -- 9
select count(*) from pg_indexes where tablename = 'two_factor';                        -- 3
select count(*) from pg_constraint where conname = 'two_factor_user_id_user_id_fkey';  -- 1
```

### 如果只想先跑这一条（谨慎操作，可选）

不需要。迁移器按目录名排序，一次跑完全部未应用的迁移；单独跳过某条反而会让记录与文件不一致。

## 已知取舍

- 用 `IF NOT EXISTS` 意味着：如果某库的 `two_factor` 表**存在但形状不对**，这条迁移不会纠正它（它会静默跳过）。
  这是有意的 —— 迁移不该覆盖既有数据；这种库需要人工比对，而不是自动重建。
- 外键没有 `IF NOT EXISTS`，所以用 `DO` 块先查 `pg_constraint`（同时限定 `conrelid`，避免同名的其它表约束误判）。
- `snapshot.json` 是上一版快照的逐字节副本、只改了 `id` 与 `prevIds`：这一条不改 schema，所以快照内容必须与上一版一致。
