## 1. Weekday-only peak rule

- [ ] 1.1 `gateway/deepseek_peak.py`: `is_peak()` returns `False` when `local.weekday() >= 5` (Sat/Sun), while keeping `PEAK_WINDOWS` (09:00-12:00, 14:00-18:00 Beijing) and `PEAK_MULTIPLIER = 2.0` unchanged
- [ ] 1.2 Confirm `billable_cost()` needs no change (2× on weekday peak only) — additive: existing Monday 09:00/10:00 assertions still pass

## 2. Official off-peak prices in config

- [ ] 2.1 `gateway/config.yaml` `deepseek-v4-flash`: in 1.5 / out 4.5 / cache-hit 0.05 (per-token and per-million-CNY fields consistent)
- [ ] 2.2 `gateway/config.yaml` `deepseek-v4-pro`: in 4.5 / out 13.5 / cache-hit 0.15
- [ ] 2.3 Verify peak = 2× off-peak yields official peak (flash in 3.0 / out 9.0, pro in 9.0 / out 27.0) with no code change beyond prices

## 3. SQL report aligned

- [ ] 3.1 `gateway/sql/daily_spend_summary.sql`: add weekday-only condition (`EXTRACT(ISODOW …) BETWEEN 1 AND 5`) to the peak predicate in `apply_peak_in_sql` mode so Sat/Sun are not re-rated at peak

## 4. Tests

- [ ] 4.1 `gateway/test_deepseek_peak.py`: existing workday peak/off-peak cases still green (2026-07-20 is a Monday)
- [ ] 4.2 Add weekend cases: peak-window times (e.g. Sat 2026-07-25 10:00 and Sun 2026-07-26 15:00) → `is_peak=False` and `billable_cost` unchanged (no 2×)
- [ ] 4.3 Run tests: `pytest gateway/test_deepseek_peak.py` (or equivalent)

## 5. Doc & note

- [ ] 5.1 `docs/后续工单-生产就绪.md`: add a closed P0 item "DeepSeek 峰谷计费对齐（周末豁免 + 官方低谷价）" cross-referencing this change
- [ ] 5.2 State explicitly: historical spend is not backfilled; new rule applies forward only