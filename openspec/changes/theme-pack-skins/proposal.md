## Why

Theme settings today only tweak light/dark plus shallow color presets and a separate font switch—insufficient for the shipped design packs, where **typography is inseparable from the visual system** (e.g. 21th mono UI, Claude editorial stacks, TRAE SF/Inter). Users need whole-skin switches that deeply remake console surfaces **and** fonts, with an optional first-login picker defaulting to Minimal.

## What Changes

- Replace appearance controls with **skin + light/dark only** (remove user-facing font / color-preset / radius / density / sidebar / layout pickers).
- Add theme packs: **Minimal** (default) + **TRAE** + **Golden Time** + **Google** + **Doubao** + **Claude** + **Apple** + **21th**.
- **Deep token remapping** for each skin: surfaces, accent, borders, radius, chart ramp, **and bound typefaces** (UI / display / mono) so switching skin changes both style and fonts product-wide on console routes.
- TRAE light tokens from `TRAE Work/`; TRAE dark tokens from `TRAE/`.
- Entry `/` and `/login` remain **brand-fixed** (not skin-driven).
- Optional post-auth style onboarding dialog; **skippable** → Minimal.
- **BREAKING** (local appearance): `aigw.appearance.v1` shape retired in favor of skin-centric settings; old font/preset keys ignored.

## Capabilities

### New Capabilities

- `theme-pack-skins`: Skin catalog, deep style+font adapters, simplified theme settings (skin + mode), and skippable first-login style picker.

### Modified Capabilities

- `minimal-theme`: Minimal becomes the default skin pack rather than the sole visual truth for the console; typography pairing is skin-owned except on brand-fixed entry.
- `console-shell`: Theme settings chrome exposes skin + mode only; shell/console consume skin tokens including fonts.

## Impact

- `web/src/lib/appearance.ts`, boot script in `layout.tsx`
- `web/src/components/theme-settings.tsx` (+ new onboarding dialog)
- `web/src/app/globals.css` (large skin × mode token maps; font variables per skin)
- Possible Next font loading for pack typefaces (or system stacks where packs specify SF/PingFang)
- Design library folders as **source references** (`TRAE/`, `TRAE Work/`, `Golden Time/`, `Google/`, `Doubao/`, `Claude/`, `Apple/`, `21th/`)—not runtime-linked wholesale
- Specs: `minimal-theme`, `console-shell`; new `theme-pack-skins`
