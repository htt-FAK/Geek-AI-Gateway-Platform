## Purpose

Defines the frontend console shell: dark design tokens, dual auth/app layouts, entry login pages, and locked brand copy for chrome and marketing surfaces.

## Requirements

### Requirement: Design tokens and dark theme
The console SHALL use the dark design tokens from the frontend design spec (steel-cyan accent `#3D8B9C`, elevated surfaces, subtle borders) via CSS variables. Components MUST NOT hard-code upstream brand colors as primary button or chrome colors.

#### Scenario: Token presence
- **WHEN** any authenticated console page renders
- **THEN** the page background and accent controls use the shared CSS variables (base/elevated/surface, accent-primary) rather than ad-hoc purple or light SaaS palettes

### Requirement: Dual shells
The system SHALL provide an auth/marketing shell (no tool sidebar) for `/` and `/login`, and an app shell (top bar + collapsible sidebar) for authenticated tool routes.

#### Scenario: Entry page has no sidebar
- **WHEN** an unauthenticated user opens `/` or `/login`
- **THEN** the layout shows the declaration + login panel composition without the 64/240 tool sidebar

#### Scenario: Tool pages use app shell
- **WHEN** an authenticated user opens `/playground`, `/models`, `/keys`, or `/dashboard`
- **THEN** the layout includes the app chrome with sidebar navigation items 调试台 · 看板 · 模型 · 密钥

### Requirement: Entry login page
`/` and `/login` SHALL be isomorphic entry pages with left declaration (product headline per copy system) and right login panel using phone + password. Successful login SHALL navigate to `/playground` (or change-password when required).

#### Scenario: Login success
- **WHEN** a user submits valid phone and password on the entry page
- **THEN** the system establishes a session and redirects to `/playground` unless password change is required

#### Scenario: Unauthenticated guard
- **WHEN** an unauthenticated user requests a protected tool route
- **THEN** the system redirects them to the entry page (`/` or `/login`)

### Requirement: Brand copy
Entry and shell chrome SHALL use the locked brand copy: product **AI Gateway**, studio **Geek / 高科极客工作室**, slogan **有趣的人，做有趣的事**, and entry headline **一个入口，调度所有大模型**.

#### Scenario: Entry hierarchy
- **WHEN** the entry page is viewed
- **THEN** the product declaration is visually dominant over the studio slogan
