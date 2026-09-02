## Why

DeepSeek moved DeepSeek-V4 series to **peak/off-peak** billing effective **2026-08-17 00:00 (Beijing)**, and on **2026-08-23** added that **Saturday & Sunday are entirely off-peak** (no peak window). Peak hours are 09:00-12:00 and 14:00-18:00 (Beijing time, weekdays only); off-peak is half of peak.

The gateway already implemented a 2x peak multiplier (`gateway/deepseek_peak.py` + `callbacks.py`) but predates this rule, so it is now wrong in two ways:

1. **Weekends are not exempt.** `is_peak()` only checks the clock window, so on Sat/Sun it still applies 2x during 09:00-12:00 / 14:00-18:00 — overcharging user budgets on weekends.
2. **Base prices are outdated.** `config.yaml` still uses the pre-08-17 flat rates (flash in ¥1.0 / out ¥2.0, pro in ¥3.0 / out ¥6.0). Official off-peak is now flash in ¥1.5 / out ¥4.5, pro in ¥4.5 / out ¥13.5 (plus new cache-hit prices). Because our multiplier only encodes peak=2×off-peak, the numbers no longer reflect real upstream spend in either window.

## What Changes

- `is_peak()` returns `False` on weekends — peak windows apply to **weekday** 09:00-12:00 & 14:00-18:00 (Beijing) only.
- `config.yaml` DeepSeek `flash` / `pro` per-million prices updated to **official off-peak** (peak stays automatically at 2× off-peak via the multiplier), including cache-hit input.
- `gateway/sql/daily_spend_summary.sql` `apply_peak_in_sql` mode made weekdays-only, matching the callback behavior.
- Unit tests updated; add weekend cases (peak-window on Sat/Sun must NOT multiply).

## Capabilities

### New Capabilities

- `deepseek-peak-pricing`: DeepSeek peak/off-peak spend adjustment aligned with the official 2026-08-17 pricing and the 2026-08-23 weekend rule (peaks apply on weekdays only; peak = 2× off-peak).

## Impact

- `gateway/deepseek_peak.py` — weekday gate in `is_peak`
- `gateway/config.yaml` — off-peak prices for `deepseek-v4-flash` / `deepseek-v4-pro` (incl. cache-hit)
- `gateway/sql/daily_spend_summary.sql` — weekday-only peak window in SQL mode
- `gateway/test_deepseek_peak.py` — new weekend assertions
- `docs/后续工单-生产就绪.md` — new P0 item cross-referencing this change

Out of scope (tracked separately in the production-readiness work ticket): network isolation, key-policy, backup, admin usage, Postgres migration, etc.