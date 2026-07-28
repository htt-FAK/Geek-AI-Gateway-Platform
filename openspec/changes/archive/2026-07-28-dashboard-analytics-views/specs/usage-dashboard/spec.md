## MODIFIED Requirements

### Requirement: Dual charts empty skeleton
Consumption distribution and model invocation analysis panels SHALL support chart chrome (titles, totals, toggles) and render **real series** via a chart library when analytics data exists for the selected range. When no series points are available, panels SHALL show the empty state「暂无数据」without erroring. Consumption toggles MUST switch between stacked bar and stacked area. Model analysis toggles MUST switch among call trend (stacked area), call distribution (donut), and call ranking (horizontal bars). Currency labels MUST use ¥.

#### Scenario: Empty charts
- **WHEN** the user opens `/dashboard` with no analytics series in range
- **THEN** both chart panels show the empty-state message without erroring

#### Scenario: Spend chart type switch
- **WHEN** analytics returns spend series and the user selects 柱状图 or 面积图
- **THEN** the consumption panel renders the corresponding stacked visualization for the same data

#### Scenario: Model analysis views
- **WHEN** analytics returns call series and the user selects 调用趋势, 调用次数分布, or 调用次数排行
- **THEN** the model panel renders trend, donut distribution, or horizontal ranking respectively

## ADDED Requirements

### Requirement: Dashboard filter and preference controls
The dashboard header SHALL provide「筛选」and「偏好设置」actions. Filter MUST allow quick ranges (at least 1 / 7 / 14 / 29 days), optional custom start/end datetime, and granularity `小时` or `天`, then apply to analytics reload. Preferences MUST let the user set default range, default granularity, default consumption chart type, and default model analysis view, persisted in the browser (localStorage).

#### Scenario: Apply filter
- **WHEN** the user applies a filter with range and granularity
- **THEN** dashboard KPIs and charts reload for that window

#### Scenario: Save preferences
- **WHEN** the user saves preference settings
- **THEN** subsequent visits initialize toggles/range from those defaults

### Requirement: Live KPI row
The dashboard KPI row SHALL display the five values from the analytics API for the active filter (count, spend ¥, tokens, RPM, TPM), not hardcoded zeros. While loading, a non-error loading state MAY be shown; on failure, the UI MUST not silently present fabricated success metrics.

#### Scenario: KPIs reflect analytics
- **WHEN** analytics returns non-zero KPIs for the selected range
- **THEN** the KPI row shows those values (spend formatted in ¥)
