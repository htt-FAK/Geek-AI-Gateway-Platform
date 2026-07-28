## Purpose

Defines Minimal dark design tokens, typography pairing, and anti-atmosphere constraints shared by entry and console surfaces.

## Requirements

### Requirement: Minimal dark token system
The web app SHALL expose a Minimal dark semantic token set (surfaces, text, primary, border, ring, radius, chart ramp) derived from `Minimalist Copy` `.dark` mappings. Product UI MUST consume these tokens (or equivalent CSS variables mapped 1:1) for chrome and primary actions. Components MUST NOT use steel-cyan `#3D8B9C` as the primary accent fill, and MUST NOT use purple-on-dark SaaS default palettes.

#### Scenario: Dark surfaces and primary contrast
- **WHEN** an authenticated or entry page renders
- **THEN** backgrounds use near-black Minimal dark surfaces and primary actions use high-contrast Minimal primary fills rather than steel-cyan fills

#### Scenario: Soft radius and border framing
- **WHEN** cards, primary buttons, and framed panels render
- **THEN** they use the shared soft radius (~0.75rem) and structural borders instead of glow, noise, or heavy shadow as the main hierarchy cue

### Requirement: Typography pairing
Interface scaffolding SHALL use Geist (or existing Geist variable) for sans UI. Selective emphasis (notably the entry headline) MAY use DM Serif Display with a serif fallback stack. Chinese text MUST remain readable via system/bundled fallbacks without requiring remote Noto downloads.

#### Scenario: Entry headline emphasis
- **WHEN** the entry page headline renders
- **THEN** it may use the serif emphasis face while surrounding chrome remains sans

### Requirement: No decorative atmosphere layer
Entry and console surfaces MUST NOT rely on photographic/anime background rotation, starfield overlays, or desktop-pet mascots as part of the default visual system.

#### Scenario: Entry has no pet or bg carousel
- **WHEN** an unauthenticated user opens `/` or `/login`
- **THEN** the page does not show the entry pet control and does not paint rotating `entry-bg` atmosphere images as the page backdrop
