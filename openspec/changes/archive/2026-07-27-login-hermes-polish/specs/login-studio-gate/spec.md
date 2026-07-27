## ADDED Requirements

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
Desktop entry MUST keep left declaration / right login, Marketing-scale negative space, a quiet login panel, near-flat dark base without noise/glow as primary atmosphere, and steel-cyan primarily on the enter control.

#### Scenario: Declaration dominates
- **WHEN** viewed at typical laptop width
- **THEN** the headline area carries primary optical weight versus the login panel

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
