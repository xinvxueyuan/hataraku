# H47 — settings navigation as a left column

The owner asked for the settings navigation to move to the left. `AdminPageShell` had been
rendering `AdminNav` as one horizontal row above the page; the nine settings pages share that
frame, so the change is two components and nothing else.

## What changed

**`admin-nav.tsx`** — now a client module:

- the nine sections are grouped 内容 (总览 / 文章 / 微言 / 项目 / 更新日志) and 账号 (站点 / 安全 /
  两步验证 / 密码); the group labels are rendered next to the links rather than folded into each label;
- `AdminNavList` is one presentational list with the `设置` landmark label and `aria-current="page"`,
  used by both the desktop column and the drawer so the two cannot drift;
- `AdminNav` is the desktop column (the shell owns the sticky positioning);
- `AdminMobileNav` is the narrow-screen disclosure. It reuses **`useDisclosure`** — the hook H39
  wrote for the header and docs menus — so the four closing paths are the same code: a
  `pointerdown` outside the element, Escape (which returns focus to the `summary`), a link
  activation inside the panel (`close`), and a route change (`key={pathname}`). No second
  disclosure implementation was added.

**`admin-page-shell.tsx`** — the frame:

- two columns from `lg` (1024px): a 13rem sticky column and the content column, with the existing
  title/description/action block moved into the content column;
- below `lg` the column disappears and the disclosure takes its place above the content;
- the shell is wider than the reading column (`main` caps at `max-w-2xl`), so it steps out of that
  width symmetrically: `relative left-1/2 w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2`. The
  content column keeps the same measure the page had before, so reading width is not sacrificed to
  fit the sidebar.

No settings page was touched. The props of the shell are unchanged.

## Measured

**Reading measure, 1440px** (same page, `/settings/admin/profile`):

| Layout | Content column | Shell |
| --- | --- | --- |
| before (horizontal row) | **640px** (the old `main section` width) | 640px |
| after (left column) | **648px** | 896px (208 sidebar + 40 gap + 648 content) |

The content column is 8px wider, never narrower; the sidebar lives in the extra width.

**`artifacts/h47/verify-sidebar.mjs` — 38 checks, all green** (Chromium against the running app):

- all nine settings pages render the visible left column with exactly nine links, and exactly one
  `aria-current="page"` naming that page (总览 / 文章 / 微言 / 项目 / 更新日志 / 站点 / 安全 /
  两步验证 / 密码), and each page's `scrollWidth === window.innerWidth` (the requested criterion,
  not `clientWidth`);
- 1024px keeps the sidebar (208px wide, left of the content) with no horizontal overflow;
- sticky: with the viewport shortened to 500px and the page scrolled to 260px, the sidebar's top
  stays at 80px and its bottom at 446px — visible while the list scrolls;
- 390px: the desktop column is gone, the disclosure is visible, and the drawer lists the same nine
  links; **all four closing paths** were exercised —
  1. `pointerdown` outside → closed,
  2. Escape → closed **and focus is on `SUMMARY`**,
  3. clicking a link inside the drawer (文章) → navigates and closes,
  4. a keyboard-activated route change (Enter on the page's own `/settings/two-factor` link, no
     pointer) → the next route starts closed;
- 390px has no horizontal overflow either.

Screenshots: `sidebar-1440.png`, `sidebar-1024.png`, `sidebar-sticky.png`,
`drawer-390-open.png`, `sidebar-390.png`.

## Narrow widths, including the effective viewport of 200% zoom

`artifacts/h47/verify-narrow.mjs` — 8 checks over 390 / 360 / 320 / 195px:

- **390, 360, 320px**: `scrollWidth === innerWidth`, the disclosure's summary sits inside the
  viewport, and the open drawer keeps its nine links and its panel inside the viewport.
- **195px** (what a 390px window becomes at 200% zoom): the shell itself is still correct — **163px
  wide at left 16**, inside the 195px viewport — but the **page** reports `scrollWidth 225`. The
  overflow is not the shell's: it comes from content that cannot wrap and from the site header, both
  outside this frame —
  - the account email in the page description (`当前账号：…`) has no break opportunity, so the
    header block inside the content column measures 205px;
  - on `/settings/admin` the header's user-menu panel (`w-44`) measures a right edge of 225px.
  The old horizontal layout has the same 205px min-content floor, so this is a pre-existing
  narrow-width wrapping gap, not a cost of the sidebar. Fixing it means `break-words`/`min-w-0` on
  such strings (and the header menu), not removing the escape.

## Architecture note: why the shell has to escape `main`

`app/layout.tsx` hard-codes the reading measure on `main` (`max-w-2xl`). Any surface that needs to
be wider must escape it, and two surfaces now do: this shell, and the docs sidebar (H43, full-bleed
to `max-w-6xl`). Two escapes is the signal that the constraint belongs to the page, not to `main`.

**① Does the escape still hold at 390 and at 200% zoom?** At 390 / 360 / 320 yes, by measurement
(`scrollWidth === innerWidth`). At the 200% zoom effective width (195px) the *shell* still fits
(163px at left 16) but the page overflows by 30px because of unbreakable content (the account email
sets a 205px min-content floor) and the header's menu panel — see the section above.

**② If `main` stops setting `max-w` and each page owns its container, how big is the change?**
`apps/web/src/app` has **34 `page.tsx` files and 2 `layout.tsx` files**; 17 app files already
mention a `max-w-`. Concretely: `app/layout.tsx` (one line), then a container on ~30 pages (or one
shared `<PageContainer>` applied per page), plus a review of the 17 files that already cap widths so
nothing is double-capped. The lower-churn variant of the same idea is **route groups**: move the page
directories into `(reading)` and `(wide)` folders, give each group its own `layout.tsx`, and leave
the 34 page bodies untouched — URLs do not change; the cost is a large rename diff.

**③ Is there a third, steadier option?** Yes: keep the reading measure as the *default* and let a
page override it through the layout, with no per-page container and no negative margins.
`main` becomes `mx-auto w-full max-w-[var(--main-width,42rem)] px-4 …`, and a wide surface renders
one marker element; a rule in `layout.tsx` upgrades the default:

```css
main:has([data-width="wide"]) {
  --main-width: 64rem;
}
```

This is one file plus one attribute on the surfaces that opt in, it is server-rendered (no flash),
and `:has()` is Baseline (Chrome 105+, Safari 15.4+, Firefox 121+). Its weakness is indirection:
the width decision lives in `layout.tsx`, so the marker has to be named clearly. A more explicit
variant is a shared `<PageContainer width="wide">` component with `main` unconstrained — the same
edit count as ②, but greppable per page.

## Verification environment note

All 38 checks above (and the 8 narrow ones) ran against a **production build** (`next build` + `next start`) on a temporary
database. That database was built manually from the repository's migration SQL, because the working
tree carried an **uncommitted migration** (content's H46, for the analytics column) that re-creates a
table an earlier migration already created, which makes the normal `createTestDatabase` path abort.
Nothing under `packages/db/src/migrations/` was modified, and the scratch database and the dev
dist directory were dropped afterwards.

The **repo-wide `pnpm run ready` and `pnpm exec e2e run` could not be completed in this shared
worktree**: the e2e API server exits with `ReferenceError: publicRoute is not defined` (another
member's in-flight public-route refactor) and a concurrent listener on port 3211; the same shared
tree also contains the unreleased migration above. Under the team's commit protocol the
authoritative gate is CI on a clean checkout, so this change is delivered with its own files clean
(`vp check --no-fmt` on the two components) and the layout evidence recorded here.