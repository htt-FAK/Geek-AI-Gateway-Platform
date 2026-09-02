## ADDED Requirements

### Requirement: Peak windows apply on weekdays only
DeepSeek peak hours SHALL be treated as the Chinese-beijing windows **09:00-12:00** and **14:00-18:00** on **weekdays (Monday-Friday)** only. On Saturday or Sunday the system MUST treat the entire day as off-peak, so no peak multiplier is applied regardless of the clock time.

#### Scenario: Weekday peak applies 2×
- **WHEN** a DeepSeek `response_cost` is recorded on a weekday (e.g. Monday 10:00, Beijing)
- **THEN** the billable cost doubles (peak) and `metadata.deepseek_peak` is marked true

#### Scenario: Weekend peak window does not multiply
- **WHEN** a DeepSeek `response_cost` is recorded on Saturday or Sunday at a time inside 09:00-12:00 or 14:00-18:00 (Beijing)
- **THEN** the billable cost stays at the stored base value (off-peak) and no peak flag is set

#### Scenario: Weekend off-peak hour does not multiply
- **WHEN** a DeepSeek `response_cost` is recorded on Saturday at an off-peak hour (e.g. 20:00, Beijing)
- **THEN** the billable cost stays at the stored base value (off-peak)

### Requirement: DeepSeek config prices equal official off-peak
The `deepseek-v4-flash` and `deepseek-v4-pro` model prices in the gateway config SHALL be set to the DeepSeek official off-peak rates (¥/1M), such that the existing 2× peak multiplier yields exactly the official peak rates.

- `deepseek-v4-flash`: input `1.5`, output `4.5`, cache-hit input `0.05`
- `deepseek-v4-pro`: input `4.5`, output `13.5`, cache-hit input `0.15`

The per-token and per-million-CNY fields MUST agree, so `response_cost` reflects off-peak spend in both windows (2× in peak).

#### Scenario: Off-peak base equals official off-peak
- **WHEN** a DeepSeek call completes during an off-peak window
- **THEN** the recorded spend equals the official off-peak price (flash in 1.5 / out 4.5; pro in 4.5 / out 13.5 per 1M tokens)

#### Scenario: Peak equals 2× official off-peak
- **WHEN** a DeepSeek call completes during a weekday peak window
- **THEN** the recorded spend equals 2× the off-peak price (flash in 3.0 / out 9.0; pro in 9.0 / out 27.0 per 1M tokens)

### Requirement: SQL replay honors the weekday rule
The `apply_peak_in_sql` mode of the daily spend report SHALL only apply the 2× peak multiplier to DeepSeek rows whose timestamp falls on a weekday (Mon-Fri) and inside a peak window (Beijing). Saturday and Sunday rows MUST be reported at stored base spend even inside 09:00-12:00 / 14:00-18:00.

#### Scenario: SQL does not peak weekends
- **WHEN** the daily spend report runs with `settled_mode = 'apply_peak_in_sql'` over a weekend DeepSeek row whose `startTime` is at 10:00 Beijing on Saturday
- **THEN** `settled_spend_cny` equals `base_spend` (no 2×) and `in_peak_window` is false