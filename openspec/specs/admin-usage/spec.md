## Purpose

Defines the admin all-members usage console at `/admin/usage`, protected by admin token and scoped across members rather than a single operator’s personal spend.

## Requirements

### Requirement: Admin usage page behind admin token
The system SHALL provide `/admin/usage` protected by the same `x-admin-token` mechanism as other `/api/admin/*` routes. The page MUST NOT appear in the end-user AppShell sidebar.

#### Scenario: Unauthorized without token
- **WHEN** a client calls admin usage APIs without a valid `x-admin-token`
- **THEN** the API responds 401

#### Scenario: Authorized skeleton
- **WHEN** an operator opens `/admin/usage` and supplies a valid admin token
- **THEN** the page loads the all-members usage console shell

### Requirement: Parity dual charts with user dashboard
`/admin/usage` SHALL include overview KPI placeholders and the same two chart panel types as the personal dashboard (consumption distribution and model invocation analysis), at equal visual prominence, with empty-state「暂无数据」when series are empty.

#### Scenario: Empty dual charts
- **WHEN** admin usage analytics return no points
- **THEN** both chart panels render empty skeletons without failure

### Requirement: Members ranking skeleton
The admin usage page SHALL include a members ranking/table region (phone, spend, request/token placeholders) that can render an empty list in this change.

#### Scenario: Empty members table
- **WHEN** no member usage rows are returned
- **THEN** the table region shows an empty state rather than crashing

### Requirement: Separate from user dashboard data scope
Admin usage views MUST aggregate or list across members; they MUST NOT be limited to the browsing operator’s personal spend only.

#### Scenario: Cross-member intent
- **WHEN** admin usage APIs are designed/called
- **THEN** the contract is all-members (or empty all-members series), not the session user’s personal `/dashboard` payload
