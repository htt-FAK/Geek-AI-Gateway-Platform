## MODIFIED Requirements

### Requirement: Design tokens and dark theme
The console SHALL consume shared semantic CSS variables for surfaces, text, accent, borders, radius, charts, and fonts. Default appearance is the Minimal skin in dark mode (near-black surfaces, muted neutrals, high-contrast primary, structural borders, soft radius) aligned with `Minimalist Copy` `.dark`. When a theme pack skin is selected, those variables MUST reflect that skin’s deep style **and** font mapping for light/dark mode. Components MUST NOT hard-code upstream vendor brand colors or steel-cyan `#3D8B9C` as primary button or chrome colors for the Minimal language. Charts MAY use the active skin’s chart ramp.

#### Scenario: Token presence
- **WHEN** any authenticated console page renders
- **THEN** the page background, accent controls, and typography use the active skin’s mapped semantic CSS variables rather than ad-hoc purple or steel-cyan primary fills

#### Scenario: Shell chrome alignment
- **WHEN** the AppShell sidebar and top bar render
- **THEN** selected/hover states use the active skin’s tonal surfaces and primary contrast rather than a steel-cyan identity bar as the sole accent language

## ADDED Requirements

### Requirement: Theme settings expose skin and mode
The console theme settings control SHALL allow choosing a theme pack skin and light/dark/system mode only. Independent controls for font, color preset, radius, density, sidebar variant, and layout variant MUST NOT appear in that panel.

#### Scenario: Settings surface
- **WHEN** the user opens theme settings from the app shell
- **THEN** they can pick a skin and a mode
- **AND** they cannot pick a standalone font family
