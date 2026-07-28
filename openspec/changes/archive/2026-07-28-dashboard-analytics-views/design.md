## Context

`/dashboard` shows real budget progress from `getBudgetUsage`, but KPIs are zeros and charts are empty shells (`EmptyChartPanel`). App traffic is recorded in `SpendEvent` (`costCny`, `model`, `createdAt` only) when `/api/chat` succeeds with cost &gt; 0. Virtual-key users can also hit LiteLLM directly; budget already pulls gateway spend sums via `fetchKeySpendLastDays`, but the board never shows those series.

Product constraints: Minimal dark theme, ¥ currency, five KPIs retained, hour + day granularity, Recharts, reference UIs for chart/control *types* only.

## Goals / Non-Goals

**Goals:**

- Real analytics API for the signed-in user: KPIs + spend series + call series.
- Enrich App `SpendEvent` with tokens; record success even when cost is ¥0.
- Include virtual-key direct gateway usage via LiteLLM spend logs without double-counting playground traffic that already hits the same key.
- Dashboard chrome: filter + preference modals; chart type switches render real Recharts views.
- ¥ throughout; empty state when no points in range.

**Non-Goals:**

- Admin all-members analytics (`/admin/usage`) rewrite.
- Error rate, cache hit rate, P95 latency KPIs (design-spec P2/P3 elsewhere).
- Server-persisted preferences (localStorage is enough).
- Historical backfill of tokens on old `SpendEvent` rows.
- Changing monthly ¥400 gate semantics.

## Decisions

### 1. Data source priority (App + gateway “merge”)

| Mode | Series / KPI source |
|------|---------------------|
| `virtual_key` (decryptable user key) | **Primary:** LiteLLM `GET /spend/logs` for that key + date range. Covers Key-direct and App-via-VK. |
| `app_enforced` or gateway logs fail/empty | **Fallback:** `SpendEvent` for `userId` + date range. |

**Do not sum** App events and gateway logs in the same window when VK logs are usable—playground would double-count. “Merge” means *union of coverage* (Key-direct appears via logs; App-only / app_enforced via `SpendEvent`), not arithmetic addition of both ledgers.

Alternatives considered: always sum both (rejected: doubles playground); always App-only (rejected: misses Key-direct); always gateway-only (rejected: breaks app_enforced).

### 2. Currency

Treat LiteLLM `spend` and `SpendEvent.costCny` as the same ¥ unit already used by budget (`Math.max(app, gw)`). No FX conversion in this change. If upstream is USD in some deploys, fix globally later with budget—not only the board.

### 3. SpendEvent schema

Add nullable/default-0 ints (or floats if needed): `promptTokens`, `completionTokens`, `totalTokens`. Keep writing from `/api/chat` on successful completion (stream and non-stream), including `costCny === 0`.

### 4. Analytics API

`GET /api/me/analytics?from=&to=&granularity=hour|day`

Response shape (illustrative):

```ts
{
  kpis: { count, spendCny, tokens, rpm, tpm },
  spendSeries: { bucket: string, byModel: Record<string, number> }[],
  callSeries:  { bucket: string, byModel: Record<string, number> }[],
  source: "litellm" | "spend_event" | "mixed_fallback"
}
```

- Buckets in Asia/Shanghai wall time.
- RPM/TPM = totals ÷ window minutes (min 1).
- Missing token fields → contribute 0; KPI may show `—` only if *no* events and no logs; otherwise show numeric 0 when events exist but tokens unknown.

### 5. Granularity defaults

Filter modal: quick ranges 1 / 7 / 14 / 29 days + custom datetime + granularity select (`小时` | `天`). Suggested defaults: 1d→hour, 7d→hour, 14/29d→day (user can override). Preferences store last/default range, granularity, consume chart mode, model chart mode.

### 6. Charts

Add **Recharts**. Map CSS variables into series colors. Types:

- Spend: stacked `BarChart` / stacked `AreaChart`
- Calls: stacked area trend / `PieChart` donut / horizontal `BarChart` ranking

### 7. LiteLLM log mapping

Extend `litellm.ts` with `fetchKeySpendLogs(apiKey, start, end)` returning raw rows. Map best-effort fields: timestamp, model/alias, spend, total_tokens / prompt / completion when present. One log row = one call for count series.

## Risks / Trade-offs

- [Double count if merge is additive] → Mitigation: source priority table above; never sum VK logs + SpendEvent for the same window when logs succeed.
- [LiteLLM log schema drift / sparse tokens] → Mitigation: defensive parsing; Token/TPM may under-report for log-only rows; footnote on dashboard.
- [Gateway down] → Mitigation: fall back to SpendEvent; surface soft warning optional, not hard error.
- [Old SpendEvent without tokens] → Mitigation: accept under-count; no migration backfill.
- [Recharts bundle size] → Mitigation: client-only dynamic import on dashboard page.
- [Spend unit mismatch USD vs ¥] → Mitigation: same assumption as existing budget; document in Open Questions if ops need FX.

## Migration Plan

1. Prisma migrate add token columns (defaults 0).
2. Deploy API + chat writers together so new traffic has tokens.
3. Ship dashboard UI with Recharts; empty state until traffic exists.
4. Rollback: revert UI to empty panels; token columns are additive and safe to leave.

## Open Questions

- Confirm LiteLLM spend logs in this deploy expose per-request `model` + timestamp reliably enough for stacked series (spike during apply if needed).
- Whether to show a small “数据来源：网关日志 / 应用记账” chip when `source` is not obvious.
