## Purpose

Defines the product brand icon set for console sidebar navigation and favicon, including secure generation constraints so API keys never land in the repository.

## Requirements

### Requirement: Generated brand icon set
The product MUST ship a consistent icon set for console sidebar navigation (Playground / Dashboard / Models / Keys) and the browser favicon (and equivalent app tab icon). Icons SHOULD be monochrome or steel-cyan line marks suitable for dark UI at ~24px, without mascot illustration or embedded text.

#### Scenario: Sidebar uses icons not single Chinese glyphs
- **WHEN** an authenticated user views the AppShell sidebar
- **THEN** each of the four primary nav items shows a dedicated icon graphic (not only a single Chinese character label)

#### Scenario: Favicon present
- **WHEN** the site is opened in a browser
- **THEN** the document uses a project favicon from shipped static assets

### Requirement: Image generation via gateway without committing secrets
Icons MAY be produced using an OpenAI-compatible `images.generate` call (`model` `gpt-image-2`, gateway `/v1` base URL). The API key MUST be supplied only via environment variable or ephemeral shell env at generation time and MUST NOT be written into the repository (source, `.env` committed files, docs, or scripts with inline secrets).

#### Scenario: No key in repo
- **WHEN** the repository is searched for the generation credential
- **THEN** no real API key string is stored in tracked files

#### Scenario: Assets are static after generation
- **WHEN** the app runs in production
- **THEN** icons are served as static files under the web app; runtime does not require the image API key to render chrome
