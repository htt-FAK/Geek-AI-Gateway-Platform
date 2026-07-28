## MODIFIED Requirements

### Requirement: Design tokens and dark theme
The console SHALL use Minimal dark design tokens (near-black surfaces, muted neutrals, high-contrast primary, structural borders, soft radius) via CSS variables aligned with `Minimalist Copy` `.dark`. Components MUST NOT hard-code upstream vendor brand colors or steel-cyan `#3D8B9C` as primary button or chrome colors. Charts MAY use the Minimal chart ramp (grayscale brand steps).

#### Scenario: Token presence
- **WHEN** any authenticated console page renders
- **THEN** the page background and accent controls use the shared Minimal dark CSS variables rather than ad-hoc purple, steel-cyan primary fills, or light SaaS palettes

#### Scenario: Shell chrome alignment
- **WHEN** the AppShell sidebar and top bar render
- **THEN** selected/hover states use Minimal tonal surfaces and primary contrast rather than a steel-cyan identity bar as the sole accent language

### Requirement: Brand copy
Entry and shell chrome SHALL use the locked brand copy: platform **高科极客 AI 网关平台**, studio **Geek / 高科极客工作室**, and entry headline **有趣的人，在这里调用世界**. The legacy slogan **有趣的人，做有趣的事** and legacy headline **一个入口，调度所有大模型** MUST NOT appear on entry or primary chrome.

#### Scenario: Entry hierarchy
- **WHEN** the entry page is viewed
- **THEN** the product declaration「有趣的人，在这里调用世界」is visually dominant over tertiary studio lines
