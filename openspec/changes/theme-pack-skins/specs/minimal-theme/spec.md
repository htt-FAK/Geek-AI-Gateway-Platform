## MODIFIED Requirements

### Requirement: Minimal dark token system
The web app SHALL expose a Minimal semantic token set (surfaces, text, primary, border, ring, radius, chart ramp, typefaces) as the **default `minimal` skin** for console surfaces, derived from `Minimalist Copy` `.dark` mappings (and the product light map for light mode). When another skin is active, console UI MUST consume that skin’s mapped semantic tokens instead. Components MUST NOT use steel-cyan `#3D8B9C` as the primary accent fill, and MUST NOT use purple-on-dark SaaS default palettes as the Minimal skin language. Entry/auth marketing surfaces remain on the brand-fixed treatment and are not required to follow non-minimal skins.

#### Scenario: Dark surfaces and primary contrast
- **WHEN** an authenticated console page renders with the Minimal skin in dark mode
- **THEN** backgrounds use near-black Minimal dark surfaces and primary actions use high-contrast Minimal primary fills rather than steel-cyan fills

#### Scenario: Soft radius and border framing
- **WHEN** cards, primary buttons, and framed panels render under the Minimal skin
- **THEN** they use the shared soft radius (~0.75rem) and structural borders instead of glow, noise, or heavy shadow as the main hierarchy cue

### Requirement: Typography pairing
Under the Minimal skin, interface scaffolding SHALL use Geist (or existing Geist variable) for sans UI. Selective emphasis (notably the entry headline) MAY use DM Serif Display with a serif fallback stack. Chinese text MUST remain readable via system/bundled fallbacks without requiring remote Noto downloads. Under non-minimal skins, console typography SHALL follow that skin’s mapped font stacks (deep binding); users MUST NOT override fonts independently of skin. Entry headline emphasis MAY remain brand/entry-specific even when a console skin is selected.

#### Scenario: Entry headline emphasis
- **WHEN** the entry page headline renders
- **THEN** it may use the serif emphasis face while surrounding chrome remains sans

#### Scenario: Skin owns console fonts
- **WHEN** the user selects a skin whose pack specifies a distinct UI/mono stack (e.g. 21th mono-forward)
- **THEN** authenticated console text uses that skin’s mapped fonts rather than the Minimal Geist pairing
