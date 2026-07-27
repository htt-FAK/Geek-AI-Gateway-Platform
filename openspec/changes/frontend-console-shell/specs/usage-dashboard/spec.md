## ADDED Requirements

### Requirement: Personal dashboard page
Authenticated users SHALL access `/dashboard` (and `/usage` SHALL redirect to `/dashboard`) showing: title/subtitle, daily/weekly/monthly budget progress, a KPI row, and two chart panels (consumption distribution and model invocation analysis). The page MUST NOT embed the API key credential card (keys live on `/keys`).

#### Scenario: Layout sections
- **WHEN** the user opens `/dashboard`
- **THEN** budget, KPI, and dual chart sections are visible in that vertical order

### Requirement: Monthly budget of 400 CNY
The system SHALL enforce a monthly spend limit of ¥400 CNY (configurable via `MONTHLY_BUDGET_CNY`, default 400) using application spend aggregation for the current calendar month (Asia/Shanghai). Chat requests that would proceed when monthly usage already meets or exceeds the limit MUST be rejected with a clear error.

#### Scenario: Under monthly limit
- **WHEN** the user’s spend in the current calendar month is below ¥400
- **THEN** chat requests are not blocked solely by the monthly gate

#### Scenario: Over monthly limit
- **WHEN** the user’s spend in the current calendar month is at or above ¥400
- **THEN** new chat requests are rejected and `/dashboard` shows the monthly progress as exhausted

### Requirement: Budget progress display
The dashboard SHALL show daily, weekly, and monthly used/limit amounts with progress indication (not「未设置」for monthly when the limit is active).

#### Scenario: Three limit columns
- **WHEN** budget usage is loaded
- **THEN** daily, weekly, and monthly columns each show used and limit values consistent with the budget module

### Requirement: Dual charts empty skeleton
Consumption distribution and model invocation analysis panels SHALL render chart chrome (titles, toggles such as bar/area or trend/distribution/rank) and an empty state「暂无数据」when no series is available. This change does NOT require real chart series data.

#### Scenario: Empty charts
- **WHEN** the user opens `/dashboard` with no analytics series
- **THEN** both chart panels show the empty-state message without erroring
