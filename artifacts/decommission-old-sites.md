# Decommissioning the two old sites

Recorded 2026-10-21, immediately before permanent deletion. Kept so the deleted state stays inspectable
after the fact (commit ids, sizes, where each site pointed).

## What was deleted

| Site | GitHub repo | Last commit | Size | Branches | Vercel project |
| --- | --- | --- | --- | --- | --- |
| nightstack (the blog this migration replaces) | `xinvxueyuan/nightstack` (private) | `19e10a9c103d84a20dd22c55400de4a14c318207` | 22.9 MB | 1 | `nightstack` = `prj_3bVrGmX5YYW53NWy9Bcv502toJJR` |
| xinvxueyuan.github.io (the earlier blog) | `xinvxueyuan/xinvxueyuan.github.io` (public, "个人博客") | `82aa8a2ca14b2dc7b339202363086bd578551580` | 70.3 MB | 2 | `xinvxueyuan-github-io` = `prj_Y2F2c2voX60rXsHzshAGMTI1qYDt` |

Both repos pointed their homepage at the site being replaced (`nightstack.vercel.app` and
`https://www.xinvstar.xyz/`), which is what identified them as the two old sites.

## What survived, and why

- **Content** was migrated to `hataraku` before this deletion and reconciled table by table
  (see `artifacts/h13/`): 16/16 tables on row count and per-row content digest, `search_index` 39/39
  vectors identical.
- **The old database** (`neondb` on the `plain-sea-29389556` branch) and the **Supabase project**
  (`dqgzzrblovhkvbatsj`) were left in place. They are backends, not sites, and they hold the only
  remaining copy of the old rows — deleting them is a separate decision.
- **The local checkout** `C:\dev\dsh\projects\nightstack` was left alone: the request covered the
  online and remote copies.

## Domains

`www.xinvstar.xyz` and `xinvstar.xyz` were moved to the `hataraku` project earlier and are no longer
attached to `nightstack`; only its automatic `nightstack.vercel.app` alias went away with it.
