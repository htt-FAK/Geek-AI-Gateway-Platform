> Scope: align DeepSeek peak/off-peak billing with the official 2026-08-17 prices and the 2026-08-23 weekend rule.
> Acceptance baseline: `gateway/test_deepseek_peak.py` green; real-call smoke (optional) matches.

## 0. Pre-requisite: cache-hit probe (do before final acceptance)

Determines whether Requirement "Cache-hit tier is priced consistently" is binding or informational.

- [ ] 0.1 Determine whether LiteLLM includes `cache_read_input_token_cost` in `response_cost` at runtime for DeepSeek. Options:
  - Inspect LiteLLM docs/source for the cost formula; or
  - Run one real DeepSeek call with a cache hit and read `metadata` / the stored `spend`.
- [ ] 0.2 Record the finding in this task file and in the work ticket.
  - If **included**: keep the cache-hit Requirement binding; ensure §2 covers all three tiers.
  - If **not included**: mark the cache-hit Requirement "informational"; still update config cache fields for forward display, but do not gate acceptance on it.

## 1. Test-environment check

- [ ] 1.1 Check the gateway env: `cd gateway && python3 -c "import pytest; print(pytest.__version__)"`.
  - If `pytest` is present → use `python3 -m pytest test_deepseek_peak.py -q`.
  - Otherwise → fall back to `unittest` or direct `python3 -c` calls importing only `deepseek_peak` (stdlib-only; runs without litellm).

## 2. Weekend exempt (`is_peak` weekday gate)

- [ ] 2.1 In `gateway/deepseek_peak.py`, inside `is_peak()`, before the window loop add `if local.weekday() >= 5: return False` (Sat/Sun).
- [ ] 2.2 Update the `is_peak` / `billable_cost` docstrings to state "weekdays (Mon-Fri) only; weekends are off-peak".
- [ ] 2.3 Confirm no caller changes: `billable_cost()` and `callbacks.py` already go through `is_peak()`, so they align automatically.
- [ ] 2.4 Sanity-check the weekday of existing test dates:
  `python3 -c "from datetime import date;print(date(2026,7,20).weekday(), date(2026,7,25).weekday(), date(2026,7,26).weekday())"` → `0 5 6` (Mon, Sat, Sun).

## 3. Base prices to official off-peak

> Both variable families must stay equal; assert `1e6 * per_token == per_million_cny`.

- [ ] 3.1 `deepseek-v4-flash` three tiers: in 1.5 / out 4.5 / cache-hit 0.05
  - [ ] 3.1.1 `input_cost_per_token: 0.0000000015` and `input_cost_per_million_cny: 1.5`
  - [ ] 3.1.2 `output_cost_per_token: 0.0000000045` and `output_cost_per_million_cny: 4.5`
  - [ ] 3.1.3 `cache_read_input_token_cost: 0.0000000005` and `cache_hit_cost_per_million_cny: 0.05`
- [ ] 3.2 `deepseek-v4-pro` three tiers: in 4.5 / out 13.5 / cache-hit 0.15
  - [ ] 3.2.1 `input_cost_per_token: 0.0000000045` and `input_cost_per_million_cny: 4.5`
  - [ ] 3.2.2 `output_cost_per_token: 0.0000000135` and `output_cost_per_million_cny: 13.5`
  - [ ] 3.2.3 `cache_read_input_token_cost: 0.0000000015` and `cache_hit_cost_per_million_cny: 0.15`
- [ ] 3.3 Assert equality, e.g. `python3 -c "assert 1e6*0.0000015==1.5"` (repeat for output/cache across both models).
- [ ] 3.4 Re-check that peak = official ×2 (flash 3.0/9.0/0.10; pro 9.0/27.0/0.30) falls out with no code change.

## 4. SQL reconciliation aligned

- [ ] 4.1 `gateway/sql/daily_spend_summary.sql`: in `apply_peak_in_sql`, add
  `AND EXTRACT(ISODOW FROM r."startTime" AT TIME ZONE 'Asia/Shanghai') BETWEEN 1 AND 5` to the peak-time predicate.
- [ ] 4.2 `in_peak_window` flag: add the same weekday condition so weekend peak-window rows are `false` and `settled_spend_cny = base_spend`.
- [ ] 4.3 Add a SQL comment "matches `callbacks.py`: weekday peak ×2 only" so one side is not edited without the other.

## 5. Unit tests

- [ ] 5.1 Regression (existing `2026-07-20` = Mon): peak windows 09:00/11:59/14:00/17:59 → `is_peak=True`; 12:00/18:00/08:59 → `False`.
- [ ] 5.2 New weekend cases (`2026-07-25` Sat / `2026-07-26` Sun):
  - peak-window times (Sat 10:00, Sun 15:00) → `is_peak` is `False`
  - `billable_cost(0.01, "deepseek-v4-flash", Sat 10:00) == 0.01` (no ×2)
  - off-peak time (Sat 20:00) → `is_peak` is `False`
- [ ] 5.3 Keep the "non-DeepSeek unaffected during peak" regression (`mimo-v2.5-pro` at a peak moment = unchanged).
- [ ] 5.4 Run: `cd gateway && python3 -m pytest test_deepseek_peak.py -q` (or the §1 fallback). All green.

## 6. Smoke (optional, real key + gateway)

- [ ] 6.1 Weekday-peak call → `LiteLLM_SpendLogs.spend` ≈ official peak and `metadata.deepseek_peak=true`.
- [ ] 6.2 Weekend-peak call → `metadata.deepseek_peak` absent and `spend` = off-peak.

## 7. Docs & work-ticket linkage

- [ ] 7.1 `docs/后续工单-生产就绪.md`: add a closed P0 item `WO-P0-05` "DeepSeek 峰谷计费对齐（周末豁免 + 官方低谷价）" linking to this change directory; add the no-backfill sentence.
- [ ] 7.2 In the ticket's "明确不做": record the known boundary "中国法定调休/节假日补班未建模，仅周末豁免".
- [ ] 7.3 `README.md` Models table: annotate that DeepSeek pricing follows the official 2026-08-17 peak/off-peak (off-peak base), so readers are not misled by stale flat prices.

## Acceptance checklist (done when all pass)

- [ ] `is_peak()` is `False` at any time on Sat/Sun
- [ ] Weekday peak windows `is_peak=True`, rest `False`, matching official 09:00-12:00 / 14:00-18:00 (Beijing)
- [ ] `config.yaml` three tiers = official off-peak, with `per_token × 1e6 == per_million_cny`
- [ ] SQL `apply_peak_in_sql` matches the callback (incl. weekend exempt)
- [ ] Unit tests green (incl. weekend cases)
- [ ] Work ticket closed item + no-backfill + statutory-holiday boundary recorded