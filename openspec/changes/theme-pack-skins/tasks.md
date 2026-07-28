## 1. Appearance model & boot

- [x] 1.1 Redesign `appearance.ts` for v2: `skin` + `theme` + `onboarded`; migrate/ignore v1 font/preset/radius/density/sidebar/layout
- [x] 1.2 Update `layout.tsx` inline boot script for v2 attrs (`data-skin`, `data-theme`) without FOUC
- [x] 1.3 Wire body/display/mono to skin-driven CSS variables (`--font-ui` / `--font-display` / `--font-mono`)

## 2. Deep skin token + font maps

- [x] 2.1 Extract Minimal light/dark as baseline skin (colors + Geist/DM Serif/mono)
- [x] 2.2 Map TRAE dark from `TRAE/` and TRAE light from `TRAE Work/` (colors + SF/Inter/JetBrains stacks)
- [x] 2.3 Map Golden Time / Google / Doubao light+dark (colors + pack fonts)
- [x] 2.4 Map Claude / Apple / 21th light+dark (colors + pack fonts; 21th mono-forward)
- [x] 2.5 Load practical web fonts via `next/font` where packs need open fonts; system fallbacks for SF Pro

## 3. Entry isolation & settings UI

- [x] 3.1 Keep `/` and `/login` brand-fixed (ignore or reset console skin look on entry shell)
- [x] 3.2 Rewrite theme settings drawer to skin grid + light/dark/system only (remove font and other pickers)
- [x] 3.3 Add skippable first-login style onboarding modal; skip → Minimal + `onboarded`

## 4. Verify

- [x] 4.1 Spot-check each skin × light/dark on shell, playground, dashboard, keys (colors **and** fonts visibly change)
- [x] 4.2 Confirm entry pages unchanged by skin; onboarding skip/confirm persistence; tsc/lint clean
