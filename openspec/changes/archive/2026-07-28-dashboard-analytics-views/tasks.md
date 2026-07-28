## 1. Data model & chat instrumentation

- [x] 1.1 Add `promptTokens`, `completionTokens`, `totalTokens` to Prisma `SpendEvent` with migration (defaults 0)
- [x] 1.2 Update `/api/chat` to write token fields from usage (stream + non-stream) and persist events even when `costCny` is 0

## 2. LiteLLM logs & analytics API

- [x] 2.1 Extend `litellm.ts` with `fetchKeySpendLogs(apiKey, start, end)` returning normalized rows (time, model, spend, tokens)
- [x] 2.2 Implement aggregation helper: bucket by hour/day (Asia/Shanghai), build `spendSeries` / `callSeries` / KPIs
- [x] 2.3 Implement `GET /api/me/analytics` with source priority (VK logs primary → SpendEvent fallback; no double-sum)
- [x] 2.4 Smoke-test analytics against App-only and VK+logs paths (manual or script)

## 3. Chart library & visualization components

- [x] 3.1 Add Recharts dependency; client-only chart module using CSS chart variables
- [x] 3.2 Build consumption panel: stacked bar ↔ stacked area + total ¥ + empty state
- [x] 3.3 Build model panel: trend / donut distribution / horizontal ranking + empty state

## 4. Dashboard filter & preferences

- [x] 4.1 Add filter modal (quick 1/7/14/29d, custom datetime, granularity hour|day, apply/reset)
- [x] 4.2 Add preference modal (default range, granularity, consume chart, model view) persisted in localStorage
- [x] 4.3 Wire dashboard header actions「筛选」「偏好设置」and initial state from preferences

## 5. Dashboard page integration

- [x] 5.1 Replace hardcoded KPI zeros with analytics fetch for active filter; format spend as ¥
- [x] 5.2 Connect both chart panels to analytics series and toggle state
- [x] 5.3 Keep budget columns via `/api/me`; preserve empty-state CTA to playground when no data

## 6. Verify

- [x] 6.1 Lint/typecheck affected web files
- [x] 6.2 Manually verify: empty range, App SpendEvent fallback, and (if gateway up) VK log-backed curves + chart toggles
