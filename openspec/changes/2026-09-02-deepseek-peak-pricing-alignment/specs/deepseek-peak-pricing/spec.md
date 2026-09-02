## ADDED Requirements

### Requirement: Peak windows apply on weekdays only
DeepSeek peak hours SHALL be interpreted, in China/Beijing local time, as the windows **09:00-12:00** and **14:00-18:00**. These windows apply **only on weekdays (Monday through Friday)**. On Saturday or Sunday the entire day SHALL be treated as off-peak: no peak multiplier is applied regardless of the clock time, and spend is recorded at the base (off-peak) value.

#### Scenario: Weekday peak applies 2×
- **GIVEN** a DeepSeek model call completes on a weekday (e.g. Monday 10:00, Beijing)
- **WHEN** its `response_cost` is finalized
- **THEN** the billable cost is multiplied by 2 (peak) and `metadata.deepseek_peak` is set true

#### Scenario: Weekend peak-window time does not multiply
- **GIVEN** a DeepSeek model call completes on Saturday or Sunday at a time inside 09:00-12:00 or 14:00-18:00 (Beijing)
- **WHEN** its `response_cost` is finalized
- **THEN** the billable cost stays at the base (off-peak) value and `metadata.deepseek_peak` is not set

#### Scenario: Weekend off-peak hour does not multiply
- **GIVEN** a DeepSeek model call completes on Saturday at an off-peak hour (e.g. 20:00, Beijing)
- **WHEN** its `response_cost` is finalized
- **THEN** the billable cost stays at the base (off-peak) value and no peak flag is set

### Requirement: DeepSeek config prices equal official off-peak
The `deepseek-v4-flash` and `deepseek-v4-pro` model prices in the gateway config SHALL be set to the DeepSeek official off-peak rates (¥/1M tokens), such that applying the existing 2× peak multiplier yields exactly the official peak rates. The per-token cost fields (`input_cost_per_token`, `output_cost_per_token`, `cache_read_input_token_cost`) and the per-million-CNY fields (`input_cost_per_million_cny`, `output_cost_per_million_cny`, `cache_hit_cost_per_million_cny`) MUST agree (i.e. `per_token * 1e6 == per_million_cny`).

Required values:

| Model | Off-peak in | Off-peak out | Off-peak cache-hit in | Peak in | Peak out | Peak cache-hit in |
|---|---|---|---|---|---|---|
| `deepseek-v4-flash` | 1.5 | 4.5 | 0.05 | 3.0 | 9.0 | 0.10 |
| `deepseek-v4-pro` | 4.5 | 13.5 | 0.15 | 9.0 | 27.0 | 0.30 |

#### Scenario: Off-peak spend equals official off-peak
- **WHEN** a DeepSeek call completes during an off-peak window
- **THEN** the recorded spend equals the official off-peak price (flash in 1.5 / out 4.5; pro in 4.5 / out 13.5 per 1M tokens)

#### Scenario: Weekday peak spend equals 2× off-peak
- **WHEN** a DeepSeek call completes during a weekday peak window
- **THEN** the recorded spend equals 2× the off-peak price (flash in 3.0 / out 9.0; pro in 9.0 / out 27.0 per 1M tokens)

#### Requirement: Cache-hit tier is priced consistently
> Verification gate: this Requirement is **binding only if** LiteLLM actually includes `cache_read_input_token_cost` in `response_cost` at runtime. That is decided by the pre-requisite probe in `tasks.md §0`. If it does not, this Requirement is treated as **informational** (config cache fields still update for forward display, but acceptance does not depend on them).

#### Scenario: Cache-hit tier is priced consistently (runtime cache-hit cost)
- **WHEN** a DeepSeek call reports a cache hit on input **and** LiteLLM includes the cache-hit cost in `response_cost`
- **THEN** the cache-hit cost component equals the configured off-peak cache-hit price (flash 0.05; pro 0.15) off-peak, and exactly 2× that during a weekday peak

### Requirement: SQL replay honors the weekday rule
The daily spend report SHALL support a replay mode (`apply_peak_in_sql`) whose peak semantics match the callback: the 2× multiplier MAY be applied only to DeepSeek rows whose timestamp falls on a **weekday** (Monday-Friday) and inside a peak window (Beijing). Saturday and Sunday rows SHALL be reported at `base_spend` even if their timestamp is inside 09:00-12:00 or 14:00-18:00, and such weekends SHALL NOT be flagged as peak.

#### Scenario: SQL replay disregards weekend peak
- **GIVEN** the report runs with `settled_mode = 'apply_peak_in_sql'`
- **AND** a DeepSeek row has `startTime` at 10:00 Beijing on a Saturday
- **THEN** `settled_spend_cny` equals `base_spend` (no 2×) and `in_peak_window` is false

#### Scenario: SQL replay multiplies weekday peak
- **GIVEN** the report runs with `settled_mode = 'apply_peak_in_sql'`
- **AND** a DeepSeek row has `startTime` at 10:00 Beijing on a Monday
- **THEN** `settled_spend_cny` equals `base_spend * 2.0` and `in_peak_window` is true

### Requirement: Existing spend is not backfilled
Spend events already stored under the previous price policy SHALL NOT be re-rerated by this change. The new peak rule and prices apply only to calls that complete after this change ships. This SHALL be documented in the work ticket.

#### Scenario: Historic rows are left unchanged
- **GIVEN** rows in `LiteLLM_SpendLogs` written before this change is deployed
- **THEN** their stored `spend` values are not readjusted by this change

### Requirement: Peak handling stays DeepSeek-only
The peak multiplier SHALL be applied only to DeepSeek models. Non-DeepSeek models (e.g. MiMo) MUST keep their configured prices unchanged in both peak and off-peak windows.

#### Scenario: MiMo unaffected during peak
- **WHEN** a MiMo model call completes during a weekday peak window
- **THEN** its billable cost equals the configured value with no 2× multiplier applied