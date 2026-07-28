## ADDED Requirements

### Requirement: Skin catalog and mode
The system SHALL support console skins: `minimal`, `trae`, `golden`, `google`, `doubao`, `claude`, `apple`, and `21th`, combined with appearance mode `light`, `dark`, or `system`. Selecting a skin MUST apply that pack’s mapped surfaces, accents, borders, radii, chart colors, **and typography** to authenticated console surfaces. TRAE light MUST map from the `TRAE Work` token source and TRAE dark MUST map from the `TRAE` token source.

#### Scenario: Switch skin remaps style and fonts
- **WHEN** an authenticated user selects a non-minimal skin
- **THEN** console UI updates semantic color tokens and body/display/mono font stacks to that skin’s mapping without a separate font control

#### Scenario: TRAE mode sources
- **WHEN** the user selects skin `trae` and mode dark
- **THEN** dark semantic tokens follow the `TRAE` pack mapping
- **AND WHEN** mode is light
- **THEN** light semantic tokens follow the `TRAE Work` pack mapping

### Requirement: Theme settings are skin plus mode only
Theme settings UI MUST expose only skin selection and light/dark/system mode. The system MUST NOT offer user controls for font family, color preset, radius, density, sidebar style, or layout density as independent appearance settings.

#### Scenario: No font picker
- **WHEN** the user opens theme settings
- **THEN** no Auto/Sans/Serif (or equivalent) font choice is available
- **AND** changing skin is the only way to change console typefaces

### Requirement: Skippable style onboarding
After the user is authenticated and not blocked on required password change, if they have not completed style onboarding, the system SHALL present a style picker that can be skipped. Skipping MUST persist Minimal as the active skin and mark onboarding complete so the prompt does not repeat. Confirming MUST persist the chosen skin and mark onboarding complete.

#### Scenario: Skip uses Minimal
- **WHEN** a first-time (not onboarded) user dismisses or skips the style picker
- **THEN** the active skin is Minimal and onboarding is marked complete

#### Scenario: Already onboarded
- **WHEN** an onboarded user opens the console
- **THEN** the style onboarding dialog is not shown automatically

### Requirement: Entry stays brand-fixed
`/` and `/login` MUST NOT adopt the user’s selected skin for their visual system; they remain on the fixed brand/entry treatment.

#### Scenario: Skin does not restyle entry
- **WHEN** a user has selected a non-minimal skin and opens `/login`
- **THEN** the entry page does not render with that skin’s console token/font mapping as its primary look
