## Purpose

Defines the Hermes–Moonshot visual and copy treatment for the isomorphic `/` and `/login` studio gateway entry, without changing auth behavior.

## Requirements

### Requirement: Studio gateway entry copy
The isomorphic `/` and `/login` entry pages MUST present **高科极客 AI 网关平台**. The dominant headline MUST be exactly **「有趣的人，在这里调用世界」**. The entry page MUST NOT show the Chinese line「有趣的人，做有趣的事」.

#### Scenario: Headline and platform name
- **WHEN** an unauthenticated user opens `/` or `/login`
- **THEN** the largest text is「有趣的人，在这里调用世界」and the chrome identifies「高科极客 AI 网关平台」

#### Scenario: No legacy Chinese slogan on entry
- **WHEN** the entry page is rendered
- **THEN** the string「有趣的人，做有趣的事」does not appear

#### Scenario: No capability laundry list
- **WHEN** the entry page is rendered
- **THEN** the declaration column MUST NOT mention DeepSeek, MiMo, OpenAI, model version tags, or密钥/用量 ops copy

### Requirement: English tertiary signature
Below or near the studio mark, the entry MAY show a tertiary English line exactly **「Interesting people. Calling the world from here.」** which MUST remain visually much smaller than the Chinese headline. Optional「Geek · 高科极客工作室」may accompany it at the same tertiary tier.

#### Scenario: English line is secondary
- **WHEN** the English signature is shown
- **THEN** its type size/weight is clearly subordinate to the Chinese headline

### Requirement: Hermes–Moonshot visual gate
Desktop entry MUST keep left declaration / right login with Marketing-scale negative space. The login side MUST present as a quiet Minimal dark bordered card (soft radius, structural border, high-contrast primary enter control). The page base MUST be a flat Minimal dark surface without photographic/anime backdrop, starfield, glow blobs, or mascot as primary atmosphere. Steel-cyan MUST NOT be required on the enter control. A low-contrast ambient “Geek” text marquee MAY appear behind content.

#### Scenario: Declaration dominates
- **WHEN** viewed at typical laptop width
- **THEN** the headline area carries primary optical weight versus the login panel

#### Scenario: Minimal login card
- **WHEN** the entry page renders on desktop
- **THEN** the login controls sit in a bordered Minimal card on a flat dark base without background-image atmosphere layers

#### Scenario: No atmosphere chrome
- **WHEN** the entry page renders
- **THEN** no desktop pet and no rotating brand background images are shown

### Requirement: Readable Chinese without remote Noto fetch
Entry MUST NOT depend on `next/font` Google Noto SC downloads for successful render.

#### Scenario: Loads without gstatic Noto
- **WHEN** fonts.gstatic.com is unreachable
- **THEN** `/login` still succeeds and Chinese remains visible via system/bundled fallbacks

### Requirement: Auth behavior unchanged
Phone + password login and redirects remain unchanged; this capability is presentation/copy only for auth flows.

#### Scenario: Login still works
- **WHEN** valid credentials are submitted
- **THEN** session and redirect behavior match the prior implementation
