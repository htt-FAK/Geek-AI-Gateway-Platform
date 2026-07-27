## 1. Entry copy

- [x] 1.1 Set headline to「有趣的人，在这里调用世界」; platform chrome to「高科极客 AI 网关平台」; remove vendor/protocol lines
- [x] 1.2 Remove「有趣的人，做有趣的事」from entry; add tertiary English「Interesting people. Calling the world from here.」(optional Geek · 高科极客工作室)
- [x] 1.3 Keep phone/password/进入 auth behavior unchanged

## 2. Entry visual

- [x] 2.1 Strip noise/strong radial glow from AuthShell; near-flat base; quiet panel; manifesto spacing
- [x] 2.2 Type hierarchy: Display XL Chinese ≫ English tertiary; steel-cyan on enter only
- [x] 2.3 Preserve entry fade + reduced-motion; no Google Noto SC next/font on entry path

## 3. Brand icons (generate, do not commit key)

- [x] 3.1 Add a local generation script that reads `AIGW_IMAGE_API_KEY` (or similar) from env only; base URL configurable; never hardcode the key
- [x] 3.2 Generate sidebar icons (playground, dashboard, models, keys) + favicon-oriented mark via `gpt-image-2`; save under `web/public/icons/` (and favicon pipeline)
- [x] 3.3 Wire AppShell nav to icons; set `app` favicon / metadata icons from shipped files
- [x] 3.4 Verify no API key appears in git-tracked files (`git grep` / status before commit)

## 4. Verify

- [x] 4.1 `/login`: headline-first, English tertiary only, full platform name, no legacy Chinese slogan
- [x] 4.2 Logged-in shell: four nav icons + tab favicon visible
- [x] 4.3 Login still reaches `/playground`
