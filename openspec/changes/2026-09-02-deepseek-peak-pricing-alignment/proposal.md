## Why

### Background

DeepSeek dropped the flat per-token price for the DeepSeek-V4 series and moved to **peak/off-peak billing** announced **2026-08-13**, effective **2026-08-17 00:00 (Beijing)**; then on **2026-08-23** added that **Saturday and Sunday are entirely off-peak**.

Official rule (primary sources: DeepSeek API pricing page + DeepSeek official announcements):

- **Peak windows (weekdays only)**: 09:00-12:00 and 14:00-18:00 (Beijing time)
- **Off-peak**: all other hours, priced at half of peak
- **Weekend**: all of Saturday and Sunday is off-peak; no peak tier
- Relationship: **peak = off-peak × 2; off-peak = peak × ½**

### Current implementation is wrong/outdated

Peak billing was already shipped before the rule (see `gateway/deepseek_peak.py` `PEAK_MULTIPLIER=2.0` + `callbacks.py` `DeepSeekPeakPricingLogger`), but it diverges from the official rule in two ways:

**① Weekends are not exempt (correctness bug)**
[`is_peak()`](../gateway/deepseek_peak.py) checks only the clock window, not the weekday. On weekends inside 09:00-12:00 / 14:00-18:00 it still applies 2×, **overcharging user budgets**, contradicting "weekend is off-peak".

**② Base prices still use the pre-08-17 flat rates (accuracy bug)**
[`config.yaml`](../gateway/config.yaml) prices for `deepseek-v4-flash` / `deepseek-v4-pro` are the old flat values:

| Model | Item | Old (current) | Official off-peak (8-17) | Official peak (=off-peak×2) |
|---|---|---|---|---|
| V4-Flash | Input (cache miss) | ¥1.0 | ¥1.5 | ¥3.0 |
| V4-Flash | Output | ¥2.0 | ¥4.5 | ¥9.0 |
| V4-Flash | Cache-hit input | ¥0.02 | ¥0.05 | ¥0.10 |
| V4-Pro | Input (cache miss) | ¥3.0 | ¥4.5 | ¥9.0 |
| V4-Pro | Output | ¥6.0 | ¥13.5 | ¥27.0 |
| V4-Pro | Cache-hit input | ¥0.025 | ¥0.15 | ¥0.30 |

Because the gateway only multiplies the base by 2 during peak, a base that is not the official off-peak price misstates **both** tiers: off-peak is understated (old < official off-peak) and peak is understated (old×2 < official peak).

### Impact

- The spend shown in user budgets / usage dashboards diverges from the real upstream bill — risking incorrect budget allowances (understatement) or incorrect weekend deductions (overcharge).
- The reconciling report (`daily_spend_summary.sql`) inherits the same weekend misjudgment when re-applying peak in SQL.

Fix accordingly: **no peak on weekends** + **base prices = official off-peak**.

## What Changes

- **`is_peak()` gains a weekday gate**: `weekday() >= 5` (Sat/Sun) returns `False` — the whole day is off-peak, no 2×.
- **`config.yaml` base prices updated to official off-peak** (including the cache-hit tier), keeping the multiplier semantics unchanged so peak automatically equals 2× off-peak.
- **`daily_spend_summary.sql` `apply_peak_in_sql` mode adds a weekday condition**, consistent with the callback.
- **`test_deepseek_peak.py` updated with weekend cases**: no 2× during peak-window times on Sat/Sun.
- **`docs/后续工单-生产就绪.md` records a closed P0 item**, and states that historical spend is not backfilled.

## Non-Goals

- **No backfill** of historical `LiteLLM_SpendLogs`; the new rule applies only to calls after ship.
- No MiMo pricing change, no new models, no dynamic model/pricing sync.
- The peak multiplier applies to DeepSeek models only; no other model is touched.
- Items unrelated to this change under the production-readiness work ticket (network isolation, key policy, backup, admin usage, Postgres migration, etc.).
- No new UI for peak/off-peak labeling (possible follow-up).

## Capabilities

### New Capabilities

- `deepseek-peak-pricing`: DeepSeek peak/off-peak spend adjustment aligned with the official 2026-08-17 pricing and the 2026-08-23 weekend rule (peak on weekdays only; peak = 2× off-peak).

## Impact

| File | Change |
|------|--------|
| `gateway/deepseek_peak.py` | `is_peak()` weekday gate (core) |
| `gateway/config.yaml` | `flash`/`pro` prices → official off-peak (incl. cache-hit) |
| `gateway/sql/daily_spend_summary.sql` | `apply_peak_in_sql` peak predicate gains weekday condition |
| `gateway/test_deepseek_peak.py` | weekend no-multiplier cases |
| `docs/后续工单-生产就绪.md` | closed P0 item + no-backfill note |

## Decision Summary

- Rule is **centralized in `is_peak()`** — callback, SQL, and tests share the same semantics.
- **Multiplier and windows unchanged**: `PEAK_MULTIPLIER=2.0`, windows 09:00-12:00 / 14:00-18:00 remain correct.
- **Base price = official off-peak**: only the price table changes; no multiplier changes.
- Default `settled_mode = 'as_stored'` is recommended (the callback already multiplies at write time); `apply_peak_in_sql` is a verification/backup path whose semantics must match.