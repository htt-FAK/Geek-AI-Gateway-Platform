## Context

LiteLLM computes `response_cost` from the per-token costs in `config.yaml`; `gateway/callbacks.py` (`DeepSeekPeakPricingLogger`) multiplies DeepSeek `response_cost` by 2 during peak and stamps `metadata.deepseek_peak` before spend hits Postgres. The SQL report (`gateway/sql/daily_spend_summary.sql`) can either trust the stored value (`as_stored`) or re-apply peak itself (`apply_peak_in_sql`).

DeepSeek official rule (effective 2026-08-17, weekend update 2026-08-23):

- Peak windows: **09:00-12:00 & 14:00-18:00 (Beijing)**
- **Weekdays only** — Sat & Sun are entirely off-peak
- Off-peak = half of peak; peak = 2 × off-peak

Official off-peak prices (¥/1M tokens):
- `deepseek-v4-flash`: in ¥1.5, out ¥4.5, cache-hit in ¥0.05
- `deepseek-v4-pro`:   in ¥4.5, out ¥13.5, cache-hit in ¥0.15

## Goals / Non-Goals

**Goals:**

- Peak windows apply only on weekdays (Beijing). Weekends get no multiplier.
- DeepSeek base prices in `config.yaml` equal the official **off-peak** rates, so the 2× peak multiplier produces the official peak rates exactly.
- SQL-off-peak report mode is consistent (weekdays-only) with the callback.
- Tests pin both the weekday peak behavior and the weekend no-multiplier behavior.

**Non-Goals:**

- Changing MiMo pricing or adding new models.
- Implementing dynamic model catalog / price sync from upstream.
- Applying the peak multiplier to anything other than DeepSeek models.
- Auditing or re-rating **historical** spend (backfill) — document instead.
- Any of the P0-P2 production-readiness items not listed in this change.

## Decisions

### 1. Weekday gate lives in `is_peak`

Centralize the rule in `gateway/deepseek_peak.py` so both the callback and any future callers share it:

```python
def is_peak(moment=None):
    local = to_shanghai(moment)
    if local.weekday() >= 5:          # Sat(5) / Sun(6) -> off-peak all day
        return False
    clock = local.timetz().replace(tzinfo=None)
    return any(start <= clock < end for start, end in PEAK_WINDOWS)
```

`PEAK_WINDOWS` and `PEAK_MULTIPLIER = 2.0` stay unchanged (peak = 2× off-peak remains correct).

### 2. `config.yaml` base = official off-peak

Keep the existing multiplier semantics and just set the CNY base prices to off-peak (¥/1M). Peak is then exactly 2× off-peak, matching the official table.

- `deepseek-v4-flash`: in `1.5`, out `4.5`, cache-hit `0.05` (→ peak in 3.0 / out 9.0 / cache 0.10)
- `deepseek-v4-pro`: in `4.5`, out `13.5`, cache-hit `0.15` (→ peak in 9.0 / out 27.0 / cache 0.30)

Update both the `_per_token` cost fields and the `_per_million_cny` fields consistently (they must agree).

### 3. SQL report mode matches

`apply_peak_in_sql` in `daily_spend_summary.sql` must add a weekday (`EXTRACT(ISODOW ...) BETWEEN 1 AND 5`) condition to its peak-time predicate, so SQL re-rating agrees with the callback (which already stored off-peak as base + 2× peak).

### 4. No backfill

Past `LiteLLM_SpendLogs` were rated against old prices. Add a note (codified in `tasks.md` and the work-ticket doc) that re-rating history is out of scope; only forward spend uses the new rule.

## Risks / Trade-offs

- **[Silent double peak in SQL if modes diverge]** BOTH the callback multiplier and the SQL `apply_peak_in_sql` mode encode the same weekday rule. Keep them in sync; the default `as_stored` mode avoids re-rating entirely.
- **[Rounding drift]** Multiplying an already-rounded stored cost could drift by a fraction of CNY. Acceptable; document that `as_stored` is recommended.
- **[China holiday workdays]** `weekday()` only covers Sat/Sun. State that Chinese statutory make-up workdays/holidays are intentionally not modeled (rules mention weekdays only); note as future enhancement.

## Migration Plan

1. Update `deepseek_peak.py` weekday gate + unit tests.
2. Update `config.yaml` prices.
3. Update SQL weekday predicate.
4. Re-run unit tests; crawling smoke on a demo call to confirm `metadata.deepseek_peak` only on weekday peak.
5. Note in `docs/后续工单-生产就绪.md` as a closed P0 item; state "no backfill".

Rollback: revert `is_peak` gate, prices, and SQL predicate as a group (they must move together).

## Open Questions

- Confirm exact old/off-peak mapping for any **cache-hit** pricing currently stored (verify LiteLLM applies `cache_read_input_token_cost` the same way at runtime).
- Whether to also expose peak/off-peak labels in the admin usage UI (nice-to-have; tracked separately).