## Purpose

Defines the single-credential `/keys` page for viewing a masked virtual key, one-time plaintext reveal, regeneration, and app-enforced key restrictions.

## Requirements

### Requirement: Single credential keys page
Authenticated users SHALL access `/keys` showing their single virtual credential: display name (phone), gateway URL, and masked key. Multi-key table management is out of scope for this change.

#### Scenario: Masked key on load
- **WHEN** the user opens `/keys`
- **THEN** the key value is shown masked (prefix/suffix only) and full plaintext is not present in the initial page payload

### Requirement: One-time reveal of existing key
If the user’s key has never been revealed (`keyRevealedAt` is null) and the key is a real virtual key (not `app_enforced`), the user SHALL be able to「获取 KEY」once. The API MUST return plaintext only in that response, persist `keyRevealedAt`, and subsequent list/me endpoints MUST continue to return only the masked form.

#### Scenario: First reveal
- **WHEN** an eligible user with `keyRevealedAt` null confirms「获取 KEY」
- **THEN** the system shows a dialog with the full key, a copy action, and a warning that the key cannot be viewed again after close
- **AND** after the dialog is dismissed, refreshing `/keys` does not expose plaintext again

#### Scenario: Reveal blocked after first time
- **WHEN** `keyRevealedAt` is already set
- **THEN**「获取 KEY」is unavailable and only「重新生成」remains for obtaining a new plaintext

### Requirement: Regenerate replaces key
「重新生成」SHALL revoke the previous gateway key when possible, issue a new virtual key, store it encrypted, return plaintext once in the response, update `keyRevealedAt`, and show the same one-time dialog and warning.

#### Scenario: Regenerate success
- **WHEN** the user confirms regenerate
- **THEN** the old key is no longer usable for gateway calls and the new key is shown once in the dialog

### Requirement: App-enforced keys are not SDK secrets
If the stored credential is `app_enforced`, the system MUST NOT present it as a copyable external API key; the UI SHALL explain that external SDK use is unavailable in that mode.

#### Scenario: App-enforced state
- **WHEN** the user’s key mode is `app_enforced`
- **THEN** reveal/copy-as-API-key actions are disabled or replaced with an explanatory message
