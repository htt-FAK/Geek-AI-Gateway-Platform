## Context

### Billing pipeline

LiteLLM computes `response_cost` (CNY) from per-token costs in `config.yaml`. `gateway/callbacks.py` `DeepSeekPeakPricingLogger` (a custom `CustomLogger`) acts on successful events for DeepSeek models:
1. decides whether it is currently peak (`is_peak`, Chinese time);
2. if so, multiplies `kwargs["response_cost"]` (or `standard_logging_object["response_cost"]`) by `PEAK_MULTIPLIER`;
3. writes `metadata.deepseek_peak=true`, `metadata.deepseek_peak_multiplier=2.0`, `metadata.currency=CNY`.

Only after that does spend land in LiteLLM Postgres `LiteLLM_SpendLogs`. So on the default path (callback enabled) **the stored value already includes the peak multiplier**; the reconciling SQL uses `settled_mode='as_stored'` and trusts the stored value.

`gateway/sql/daily_spend_summary.sql` also exposes `settled_mode='apply_peak_in_sql'`: it re-applies `base_spend * 2.0` for DeepSeek rows that fall inside the peak clock window. The "peak" semantics of these two paths **must agree**, otherwise you get "callback multiplied, SQL multiplies again" or "neither multiplies".

### Current code (key excerpts)

`gateway/deepseek_peak.py`:

```python
SHANGHAI = ZoneInfo("Asia/Shanghai")
PEAK_MULTIPLIER = 2.0
PEAK_WINDOWS = (
    (time(9, 0), time(12, 0)),   # 09:00-12:00
    (time(14, 0), time(18, 0)),  # 14:00-18:00
)

def is_peak(moment=None) -> bool:
    local = to_shanghai(moment)
    clock = local.timetz().replace(tzinfo=None)
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False
```

Problem: `is_peak` never checks `local.weekday()`.

`config.yaml` (the two variable families must agree):

```yaml
# flash example
input_cost_per_token: 0.000001            # = 1.0 / 1e6
output_cost_per_token: 0.000002           # = 2.0 / 1e6
cache_read_input_token_cost: 0.00000002   # = 0.02 / 1e6
input_cost_per_million_cny: 1.0
cache_hit_cost_per_million_cny: 0.02
output_cost_per_million_cny: 2.0
```

## Goals / Non-Goals

### Goals

- Peak occurs **only on weekdays (Mon-Fri)** in 09:00-12:00 / 14:00-18:00 (Beijing). Weekends never trigger a peak multiplier.
- `deepseek-v4-flash` / `deepseek-v4-pro` base prices = **official off-peak** (including cache-hit), so the existing 2× multiplier equals the official peak exactly.
- SQL `apply_peak_in_sql` matches callback semantics (also weekday-only).
- Tests lock both "weekday peak ×2" and "weekend never ×2".
- Historical spend is not backfilled; only new calls follow the new rule (recorded as an explicit convention).

### Non-Goals

- No MiMo pricing change, no new models, no dynamic catalog/pricing sync.
- Peak multiplier does not apply to non-DeepSeek models.
- No re-rating / backfill of existing `LiteLLM_SpendLogs`.
- No peak/off-peak UI labeling in this change (separate follow-up).
- No modeling of China statutory holidays / makeup workdays; we distinguish only Sat/Sun (the rule is described as "weekdays"/"weekends"). See Risks.

## Decisions

Each decision maps to one or more requirements in `specs/deepseek-peak-pricing/spec.md` (marked `↦ Req`).

### Decision 1 — Centralize the weekday gate in `is_peak()`

`↦ Req: Peak windows apply on weekdays only`

Modify `gateway/deepseek_peak.py`, adding a weekday check before the window loop:

```python
def is_peak(moment=None) -> bool:
    """DeepSeek peak decision (Beijing time). Peak is 09:00-12:00 and
    14:00-18:00, weekdays (Mon-Fri) only; the whole of Saturday/Sunday is off-peak."""
    local = to_shanghai(moment)
    if local.weekday() >= 5:   # Sat=5, Sun=6
        return False
    clock = local.timetz().replace(tzinfo=None)
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False
```

- `weekday()`: Mon=0 … Sun=6, so `>=5` means Sat/Sun.
- `PEAK_WINDOWS`, `PEAK_MULTIPLIER=2.0`, `billable_cost()`, `to_shanghai()` **do not change**.
- Because `billable_cost()` calls `is_peak()` internally, no caller changes are needed and `callbacks.py` aligns automatically.

### Decision 2 — Base prices = official off-peak (both variable families)

`↦ Req: DeepSeek config prices equal official off-peak`

Change both the `_per_token` fields (used to compute fractional cost) and the `_per_million_cny` fields (used for display/ledger) and keep them equal.

`deepseek-v4-flash` (old → new):

```yaml
input_cost_per_token: 0.0000015           # 1.5 / 1e6
output_cost_per_token: 0.0000045          # 4.5 / 1e6
cache_read_input_token_cost: 0.00000005   # 0.05 / 1e6
input_cost_per_million_cny: 1.5
cache_hit_cost_per_million_cny: 0.05
output_cost_per_million_cny: 4.5
```

`deepseek-v4-pro`:

```yaml
input_cost_per_token: 0.0000045           # 4.5 / 1e6
output_cost_per_token: 0.0000135          # 13.5 / 1e6
cache_read_input_token_cost: 0.00000015   # 0.15 / 1e6
input_cost_per_million_cny: 4.5
cache_hit_cost_per_million_cny: 0.15
output_cost_per_million_cny: 13.5
```

Expected checks (peak = off-peak × 2):

| Model | Off-peak in | Off-peak out | Off-peak cache-hit | Peak in | Peak out | Peak cache-hit |
|---|---|---|---|---|---|---|
| flash | 1.5 | 4.5 | 0.05 | 3.0 | 9.0 | 0.10 |
| pro | 4.5 | 13.5 | 0.15 | 9.0 | 27.0 | 0.30 |

These values match the DeepSeek official pricing page (2026-08-17 revision).

### Decision 3 — SQL replay matches the callback

`↦ Req: SQL replay honors the weekday rule`

In `gateway/sql/daily_spend_summary.sql`, the `apply_peak_in_sql` branch adds a weekday condition to its peak-time predicate, multiplying only "weekday peak" rows:

```sql
-- peak window 且 周一~周五（ISODOW 1-5）
AND EXTRACT(ISODOW FROM r."startTime" AT TIME ZONE 'Asia/Shanghai') BETWEEN 1 AND 5
```

Likewise the `in_peak_window` flag column gets the same weekday condition, so a weekend row inside 09:00-12:00 / 14:00-18:00 counts as `in_peak_window=false` and `settled_spend_cny` stays `base_spend`.

### Decision 4 — Test strategy and date selection

Run unit tests only against `deepseek_peak` helpers; do not require a live LiteLLM chain.

- Existing assertion dates `2026-07-20` are a **Monday** (verified) — still valid after the weekday gate.
- Add cases for `2026-07-25` (**Saturday**) and `2026-07-26` (**Sunday**) covering "peak-window time on weekend does not multiply".

### Decision 5 — No backfill, forward only

`↦ Req: Existing spend is not backfilled`

`LiteLLM_SpendLogs` rows before 08-17 were logged at old prices and are **not re-rated**. Rationale: the rate change affects only subsequent calls; rewriting history would break already-reconciled figures. This convention lives in both `tasks.md` and the work ticket.

### Cache-hit pre-requisite (runtime assumption to verify)

Before finalizing the cache-hit tier in the spec is treated as binding, one probe MUST confirm whether LiteLLM actually includes `cache_read_input_token_cost` in `response_cost` at runtime. If it does not, the cache-hit tier updates in config are still applied for forward display but the cache-hit Requirement is downgraded to "informational" — see `tasks.md §0`.

### Alternatives considered

- **A: hardcode peak values in config, drop the multiplier** — rejected: peak prices may drift again; keeping "multiplier + off-peak base" is easier to maintain and `metadata` already exposes the multiplier for audit.
- **B: zero the callback and re-rerate entirely in SQL** — rejected: callback-at-write is the default path; larger blast radius. Keep the single "storage already includes peak" rule.
- **Statutory holidays as weekends** — not modeled; we distinguish only Sat/Sun, matching the literal "weekdays" rule; recorded as a known boundary.

## Risks / Trade-offs

| Risk | Description | Mitigation |
|---|---|---|
| Dual-path drift | Callback soaks peak then SQL multiplies again (or neither) | Default `as_stored`; both paths gate on weekday with the same source; reconciliation smoke |
| Rounding drift | Multiplying an already-rounded stored value accumulates CNY-fraction errors | Keep 8 decimal places (SQL already `ROUND(…, 8)`); prefer `as_stored` |
| Statutory holidays unmodeled | A makeup-work Saturday treated as weekend; a holiday Monday treated as weekday | Rule is literally "weekdays/weekends"; record as known limitation, possible later enhancement |
| Variable-family mismatch | Only one of `_per_token` / `_per_million_cny` changed → ledger drift | Change both columns in the same task and assert equality (`1e6 * token == million`); add an assertion step |
| Cache-hit tier mishandled | Cache-hit prices dominate; missing them visibly understates spend | Add the pre-requisite cache probe (§Decision 4 + tasks §0); cover all three tiers in the acceptance table |
| Test runner assumed | `pytest` may not be installed in the gateway env | Tasks pin a fallback (`unittest` or direct `python3 -c` with the helpers only, since `deepseek_peak` is stdlib-only) |

## Migration Plan

1. Add the pre-requisite cache probe (does `response_cost` include cache-hit?) — decided before final acceptance.
2. Update `deepseek_peak.py` and run the tests (regression first, then new cases).
3. Update `config.yaml` prices for both models, all three tiers (both variable families).
4. Update `daily_spend_summary.sql` `apply_peak_in_sql` predicate and `in_peak_window` flag.
5. Smoke (optional, real key): one weekday-peak and one weekend-peak call; verify `LiteLLM_SpendLogs.spend` and `metadata.deepseek_peak`.
6. Record a closed P0 item in `docs/后续工单-生产就绪.md` + no-backfill note; align README Models table.

**Rollback**: revert `is_peak`'s weekend gate, `config.yaml` prices, and the SQL predicate **together** (they are interdependent; reverting only one makes peak semantics inconsistent).

## Open Questions

- Whether LiteLLM includes the cache-hit cost in `response_cost` at runtime (probing; if not, cache-hit requirement is downgraded to informational).
- Whether to surface peak/off-peak in the admin usage UI (separate change; not implemented here).