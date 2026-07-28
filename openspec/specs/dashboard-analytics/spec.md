## Purpose

Personal dashboard analytics: API aggregation of spend/call series (¥), SpendEvent token enrichment, and merge of LiteLLM virtual-key spend logs without double-counting App-via-VK traffic.

## Requirements

### Requirement: Analytics API for personal dashboard
The system SHALL expose an authenticated `GET /api/me/analytics` (or equivalent under `/api/me`) that accepts a time range (`from`, `to`) and `granularity` of `hour` or `day`, and returns KPIs plus spend and call series bucketed in Asia/Shanghai time, with monetary values in ¥ (CNY).

#### Scenario: Authenticated query
- **WHEN** a signed-in user requests analytics with a valid range and granularity
- **THEN** the response includes KPI totals and time-bucketed `spendSeries` / `callSeries` without requiring admin role

#### Scenario: Unauthorized
- **WHEN** an unauthenticated client calls the analytics endpoint
- **THEN** the request is rejected (401/403 consistent with other `/api/me` routes)

### Requirement: Merge App spend events and LiteLLM key logs
When the user has a usable virtual key, analytics SHALL prefer LiteLLM spend logs for that key as the primary series source so Key-direct gateway traffic is included. When the user is app-enforced or gateway logs are unavailable/empty, analytics SHALL fall back to `SpendEvent` rows. The system MUST NOT add App events and gateway logs together for the same window when gateway logs are used as primary (avoid double-counting App-via-VK traffic).

#### Scenario: Virtual key with gateway logs
- **WHEN** the user has a virtual key and LiteLLM returns spend logs in range
- **THEN** KPIs and series are derived from those logs (including Key-direct usage)

#### Scenario: App-enforced fallback
- **WHEN** the user has no usable virtual key (app-enforced) or gateway logs fail/return empty
- **THEN** KPIs and series are derived from `SpendEvent` for that user and range

### Requirement: SpendEvent token enrichment
Successful App chat completions SHALL persist `SpendEvent` rows that include prompt/completion/total token counts when available, and SHALL record an event even when `costCny` is zero.

#### Scenario: Zero-cost success
- **WHEN** a chat completion succeeds with zero reported cost
- **THEN** a `SpendEvent` is still written with model and token fields (tokens may be zero if upstream omitted usage)

#### Scenario: Token fields present
- **WHEN** upstream usage includes token counts
- **THEN** the stored event preserves those counts for later analytics aggregation

### Requirement: Five KPI definitions
For the selected window the API SHALL compute: request count, total spend (¥), total tokens, average RPM (requests ÷ window minutes), and average TPM (tokens ÷ window minutes). Window minutes MUST be at least 1.

#### Scenario: KPI payload
- **WHEN** analytics returns successfully
- **THEN** the five KPI values are present and expressed for the requested window
