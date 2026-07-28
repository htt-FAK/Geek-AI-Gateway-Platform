## Context

Console appearance is driven by `aigw.appearance.v1` (`theme`, `preset`, `font`, `radius`, `density`, `sidebar`, `layout`) and shallow `html[data-preset]` accent overrides. Design library folders in the repo (`TRAE/`, `TRAE Work/`, `Golden Time/`, `Google/`, `Doubao/`, `Claude/`, `Apple/`, `21th/`) define complete token + type systems; TRAE is split **dark-only** (`TRAE/`) and **light-only** (`TRAE Work/`). Product already uses semantic variables (`--bg-base`, `--text-primary`, `--accent-primary`, `--font-geist-sans`, `--font-display`, `--font-mono`).

User decisions: depth **B** (token remapping, not layout forks); settings **skin + mode only**; entry **brand-fixed**; onboarding **skippable → Minimal**; **style and fonts both deep** per skin.

## Goals / Non-Goals

**Goals:**

- One `data-skin` + `data-theme` (light/dark/system) driving console chrome, components, charts, **and typography**.
- Per-skin adapters mapping pack tokens → product semantic CSS variables, including font stacks (and loaded web fonts where practical).
- Simplified theme drawer; optional first-login style picker (skip = Minimal).
- Keep `/` + `/login` on fixed Geek/Minimal brand treatment regardless of skin.

**Non-Goals:**

- Rebuilding pages to match each pack’s `ui_kits/*/index.html` DOM.
- Shipping pack `components.css` / `.ds-*` as the app component system.
- Syncing appearance to the server DB.
- Skinning admin-only routes beyond shared CSS variables (best-effort inherit).
- Exact pixel parity with every pack preview; adapters are faithful approximations.

## Decisions

### 1. Storage shape `aigw.appearance.v2`

```ts
{ skin: SkinId; theme: "light" | "dark" | "system"; onboarded: boolean }
```

Migrate: if only v1 present, map `preset:default`+dark → `{ skin:"minimal", theme, onboarded:true }` (treat existing users as onboarded to avoid forced popup). Ignore `font`/`preset`/etc.

### 2. Skin IDs and sources

| Skin | Light source | Dark source |
|------|--------------|-------------|
| `minimal` | product light map | current Minimal dark (default) |
| `trae` | `TRAE Work/colors_and_type.css` | `TRAE/colors_and_type.css` |
| `golden` | Golden Time tokens | Golden Time `.dark` |
| `google` | Google light | Google dark |
| `doubao` | Doubao light | Doubao dark |
| `claude` | Claude light/warm | Claude dark if present, else derived |
| `apple` | Apple light | Apple dark |
| `21th` | 21th light | 21th dark |

### 3. Deep style + font remapping

Each skin×mode block under `html[data-skin="…"][data-theme="…"]` (or `html.dark`/`html.light` + skin) MUST set at least:

- Surfaces: `--bg-base`, `--bg-elevated`, `--bg-surface`, `--bg-hover`
- Text: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`
- Accent / status / border / overlay / chart-*
- Radius semantic (`--radius-md` …) when pack radius differs (e.g. 21th `0`)
- **Fonts**: `--font-ui` (body), `--font-display`, `--font-mono` → `body` / `.font-display` / `.mono` consume these; **no user font override**

Font loading: prefer Next `next/font` for open fonts (Geist, Inter, JetBrains Mono, etc.); for proprietary names (SF Pro) use documented system stacks. Switching skin updates `document.documentElement` font CSS variables immediately.

### 4. Settings UI

Theme drawer sections: **皮肤** (swatch cards) + **明暗** (system/light/dark). Remove font, preset, radius, density, sidebar, layout sections.

### 5. Onboarding

After password gate is clear, if `!onboarded`, show modal listing skins + Skip / Confirm. Skip or Confirm sets `onboarded:true`. Entry pages never show this.

### 6. Entry isolation

Auth shell pages do not apply `data-skin` from user preference (boot script may still set attrs globally—entry CSS must reset/ignore skin and use brand-fixed rules under a layout marker such as `data-shell="entry"`).

Alternatives considered: apply skin to entry (rejected); fork layouts per skin (rejected as C).

## Risks / Trade-offs

- [Pack token names diverge] → Hand-written adapter tables per skin; spot-check against pack README swatches.
- [SF Pro unavailable on Windows] → Fallbacks PingFang / Segoe / system-ui; document acceptable drift.
- [Flash of wrong theme] → Keep inline boot in `layout.tsx` for v2 keys.
- [21th / Claude fonts feel “wrong” if only colors change] → Explicitly prioritize font variable swaps in QA checklist.
- [CSS size growth] → One file or `styles/skins/*.css` imported from globals; avoid duplicating component rules.

## Migration Plan

1. Ship v2 reader that accepts v1 and writes v2 on next save.
2. Deploy skin CSS + simplified settings + onboarding.
3. Rollback: keep semantic variable names stable; remove skin blocks / revert settings UI.

## Open Questions

- Whether Claude pack includes a true dark block or needs a documented derived dark.
- Exact Next font subset list per skin (finalize during apply while reading each `colors_and_type.css`).
