## Why

Personal `/dashboard` already has budget columns and chart chrome, but KPIs are hardcoded zeros and charts stay empty. Users need real usage curves (spend + model calls) that include both App chat traffic and direct gateway usage via the user’s virtual key, so the board reflects actual gateway activity—not only playground clicks.

## What Changes

- Enrich `SpendEvent` with token fields; record successful App chat events even when cost is ¥0.
- Add authenticated analytics API that aggregates KPIs and time-bucketed series (hour or day) in ¥.
- Merge LiteLLM `/spend/logs` for the user’s virtual key with App `SpendEvent` data (dedupe / union rules in design) so Key-direct traffic appears on the board.
- Upgrade `/dashboard`: header actions「偏好设置」+「筛选」, five real KPIs, Recharts-backed charts:
  - Consumption: stacked bar ↔ stacked area by model
  - Model calls: trend (stacked area) / distribution (donut) / ranking (horizontal bars)
- Persist dashboard preferences (default range, granularity, chart modes) in localStorage.
- Keep product Minimal dark styling; reference UIs are type/layout only. Currency remains ¥.

## Capabilities

### New Capabilities

- `dashboard-analytics`: Analytics API, spend/call series aggregation, SpendEvent token enrichment, and merge of LiteLLM key spend logs into personal dashboard metrics.

### Modified Capabilities

- `usage-dashboard`: Replace “empty chart skeleton only” with real series, filter/preference chrome, and live KPIs; keep budget progress and ¥400 monthly gate behavior.

## Impact

- `web/prisma` schema + migration (`SpendEvent` tokens)
- `web/src/app/api/chat/route.ts` (richer event writes)
- New `web/src/app/api/me/analytics` (or equivalent)
- `web/src/lib/litellm.ts` (richer spend log fetch for series, not only sum)
- `web/src/app/dashboard/page.tsx`, `web/src/components/charts.tsx`
- New dependency: Recharts
- Budget enforcement logic unchanged except shared helpers if reused for date windows
