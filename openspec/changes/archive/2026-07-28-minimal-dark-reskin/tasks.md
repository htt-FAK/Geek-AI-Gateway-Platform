## 1. Tokens & foundations

- [x] 1.1 Map `Minimalist Copy` `.dark` semantics into `web/src/app/globals.css` (surfaces, text, primary, border, ring, radius, chart)
- [x] 1.2 Add DM Serif Display (or document serif fallback stack) for entry headline emphasis; keep Chinese sans fallbacks
- [x] 1.3 Retire steel-cyan as `--accent-primary` for primary buttons/chrome (keep only if needed for non-primary legacy, prefer remove)

## 2. Entry page (Minimal card on dark base)

- [x] 2.1 Remove atmosphere: background carousel/`entry-bg*` usage, `.entry-stars`, and `EntryPet` from entry
- [x] 2.2 Restyle `AuthShell` to flat Minimal dark base + restrained header (keep GEEK wordmark unless swapped later)
- [x] 2.3 Restyle `EntryLogin` form into bordered Minimal card (radius, inputs, remember/forgot, primary enter)
- [x] 2.4 Keep copy lock: headline「有趣的人，在这里调用世界」, platform「高科极客 AI 网关平台」, optional English tertiary

## 3. Console shell & pages

- [x] 3.1 Restyle `AppShell` sidebar/top bar/nav active states to Minimal dark tonal pattern
- [x] 3.2 Align shared `.panel` / `.btn` / `.field` / tables/charts with Minimal borders and primary
- [x] 3.3 Sweep playground, dashboard, models, keys, change-password, admin pages for leftover steel-cyan/glow/atmosphere classes

## 4. Verification

- [x] 4.1 Visual check `/login` and `/playground` at desktop + narrow width
- [x] 4.2 Confirm auth flows unchanged (login, remember, forgot hint, redirect)
- [x] 4.3 Confirm no pet / no bg carousel on entry; Chinese readable without remote Noto
