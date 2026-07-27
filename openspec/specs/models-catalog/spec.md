## Purpose

Defines the authenticated `/models` catalog listing gateway model ids with provider cues and actions to try models in the playground or open docs.

## Requirements

### Requirement: Models list page
Authenticated users SHALL access `/models` listing gateway model ids from the platform configuration, grouped or listed with provider cue (DeepSeek / MiMo dot) and secondary capability text where available.

#### Scenario: Models rendered
- **WHEN** an authenticated user opens `/models`
- **THEN** each configured gateway model id appears as a list row with status or availability indication

### Requirement: Trial and docs actions
Each model row SHALL offer actions to try in playground and open docs (docs URL may be placeholder until docs deploy).

#### Scenario: Try in playground
- **WHEN** the user activates「在调试台试用」on a model row
- **THEN** they navigate to `/playground` with that model selected when feasible
