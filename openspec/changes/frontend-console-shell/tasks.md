## 1. Foundations (tokens, deps, data)

- [x] 1.1 Add CSS design tokens (steel-cyan, surfaces, borders, text, chart neutrals) in `globals.css` / theme mapping; remove provisional teal/glow as primary chrome
- [x] 1.2 Wire fonts (Instrument Sans / Geist / IBM Plex Mono + CN fallback) via `next/font` in root layout
- [x] 1.3 Add UI deps as needed (Radix Dialog/Select/Switch/Slider, Motion); keep Tailwind 3 + CSS variables acceptable
- [x] 1.4 Prisma: add `User.keyRevealedAt DateTime?`; migrate; expose masked-key helper
- [x] 1.5 Env: `MONTHLY_BUDGET_CNY` default `400`; document in `.env.example`

## 2. Console shell & entry

- [x] 2.1 Build `AuthShell` / marketing entry layout (no sidebar) and `AppShell` (52px top + 64/240 sidebar, nav: 调试台·看板·模型·密钥)
- [x] 2.2 Rebuild `/` and `/login` as isomorphic entry (left declaration + right phone/password panel; brand copy per spec)
- [x] 2.3 Update middleware: protect tool routes → redirect entry; `/` no longer blind-redirect to playground when logged out; `/usage` → `/dashboard`
- [x] 2.4 Apply route transition / button hover motion per design spec (console 150–200ms; entry staggered fade)

## 3. Budget: monthly ¥400

- [x] 3.1 Extend `getBudgetUsage` / `assertWithinBudget` with calendar-month (Asia/Shanghai) spend vs ¥400
- [x] 3.2 Include `monthlyUsed` / `monthlyLimit` in `/api/me` (and reject chat when monthly exhausted)
- [x] 3.3 Surface clear monthly-limit error to playground/chat clients

## 4. API key one-time reveal

- [x] 4.1 `GET` keys/me fields: `keyMasked`, `keyRevealedAt`, `keyMode`, gateway URL — never full plaintext
- [x] 4.2 `POST /api/keys/reveal`: only if `keyRevealedAt` null and virtual_key; atomic set timestamp; return plaintext once
- [x] 4.3 Update reissue (user and/or admin path used by UI): return plaintext once; set `keyRevealedAt`; revoke old key
- [x] 4.4 Build `/keys` page: credential panel, reveal/regenerate dialogs with one-time warning; block reveal for `app_enforced`

## 5. Playground workbench

- [x] 5.1 Reskin `/playground` into AppShell workbench: System Prompt, role message stream, right parameter panel, composer, token strip
- [x] 5.2 Wire parameters (model, temperature, max tokens, stream) into `/api/chat` send path as needed
- [x] 5.3 Add「查看代码」dialog with gateway `/v1` snippet + copy
- [x] 5.4 Preserve streaming + stop; show budget hint without owning the full dashboard

## 6. Models catalog

- [x] 6.1 Add `/models` list rows from `GATEWAY_MODELS` (provider dots, try-in-playground, docs link placeholder)

## 7. Personal usage dashboard

- [x] 7.1 Add `/dashboard` with budget three-column progress (日/周/月), KPI row skeleton, dual chart empty panels (消耗分布 / 模型调用分析)
- [x] 7.2 Ensure no API key card on dashboard; link to `/keys` or `/models` as needed
- [x] 7.3 Add `/usage` redirect to `/dashboard`

## 8. Admin usage (token gate)

- [x] 8.1 Add `/api/admin/usage` (or equivalent) behind `requireAdmin`, returning empty series + empty members list for now
- [x] 8.2 Build `/admin/usage`: admin-token gate UX (aligned with `/admin/users`), overview KPI placeholders, dual charts empty parity, members table empty state
- [x] 8.3 Keep admin pages out of end-user AppShell nav

## 9. Polish & verify

- [x] 9.1 Align admin `/admin/users` chrome lightly with dark tokens (functional parity preserved)
- [x] 9.2 Smoke: login → playground; reveal once → refresh masked; regenerate; monthly gate; admin usage empty charts with token
- [x] 9.3 Update handoff note / README snippet: Key one-time reveal + monthly ¥400 + new routes
