# Design review — 2026-10-21

Reviewed against the `frontend-design` and `ui-ux-pro-max` skills. Method: real screenshots at 1440 and
390 (home, article list, micro empty state, admin index), plus measured contrast ratios computed in the
browser from painted colours (canvas-normalised, because Tailwind v4 emits `lab()`).
Baseline from `ui-ux-pro-max --design-system`: **Swiss Modernism 2.0, editorial black + accent pink** —
which is the direction the site already follows.

## What already holds up

- **Contrast is genuinely good.** Measured against the painted background: dark h1 17.2 / body 7.2 /
  muted 7.2; light h1 17.3 / body 5.86 / muted 5.86. All well past WCAG AA 4.5, in both themes.
- **Chinese typography breathes.** 18px body, comfortable leading, one clear scale.
- **Empty states invite action** rather than saying "nothing here".
- **Both themes are designed**, not one inverted from the other.
- **Accessibility floor is in place**: skip link, `lang=zh-CN`, `aria-current`, keyboard-reachable nav.

## P0 — visible quality defects

### 1. Mobile cards are crushed
At 390px the thumbnail keeps its 120px width, so the text column is ~190px: titles wrap to 3 lines and
summaries to 6–7. Six cards make the home page ~1500px tall and hard to scan.
**Fix:** under ~640px either stack (cover above, full width) or drop the thumbnail.

### 2. Cover placeholders render meaningless glyphs
Cards show `—`, `2`, `深`, `N`, `C`. Two posts show an em dash and one shows a bare digit ("2026年…" → `2`).
A placeholder should read as an intentional mark, never as a truncated fragment.
**Fix:** take the first **letter or Han character**, skipping digits and punctuation; fall back to a site mark.

### 3. The API pill sits in the public content flow
`API Connected` is self-diagnostic, sits directly under the tagline, and on mobile stretches the full width
like an input field.
**Fix:** move it to the footer, or show it only when the API is *not* connected.

### 4. Footer leaks implementation
"© 夜行栈 · 内容与装备数据来自 Postgres" tells a reader about the database, and "装备" is the wrong word
(that reads as equipment). Copy should name things by what the reader understands.

### 5. Admin cards mix two kinds of information in one slot
文章「39 篇 · 草稿 1」, 微言「0 条」, 项目「2 个」 are counts; 站点「站点资料」, 安全「账号」, 密码「账号」,
两步验证「账号」 are category words — same position, different meaning, so the column reads as inconsistent.

## P1 — worth fixing while in there

6. **The article list is ten identical cards.** No lead item, no variation in weight; every card is the
   same rectangle. One entry (the most recent) could carry more weight so the eye has somewhere to land.
7. **Pagination gives no disabled affordance.** On page 1, 上一页 looks as clickable as 下一页.
8. **Tag rows break badly.** A couple of tags wrap onto a line of their own (`#gtstack-compose #kotlin`);
   better to keep one row with `+N` or balance the wrap.
9. **Admin copy talks to its author**: "数量与你打开的那一页始终一致" explains an implementation invariant.
10. **Admin cards print route paths** (`/micro`); a reader does not navigate by path.
11. **Micro empty state leaves ~500px of void** before the footer, which reads as an unfinished page.
12. **Mobile header packs three controls** (user chip, theme, menu) into one row and squeezes the brand.

## P2 — polish

13. Placeholder glyphs are decorative but not `aria-hidden`, so a screen reader reads "2" and "深".
14. The status pill renders at 12px — the smallest text on the site.
