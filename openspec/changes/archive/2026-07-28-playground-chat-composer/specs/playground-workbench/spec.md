## MODIFIED Requirements

### Requirement: Debug workbench layout
The `/playground` page SHALL present a conversation-test workbench: a role-labeled message stream (not chat bubbles), a bottom composer containing the prompt field plus toolbar actions (clear, thinking depth when supported, model select, send), and a token summary. System Prompt, Temperature, Max tokens, and Stream MUST NOT occupy the first viewport; they SHALL be reachable only via an「高级」entry. The page MUST NOT show a persistent right-hand parameter panel on the primary layout.

#### Scenario: Empty conversation
- **WHEN** the user opens playground with no messages
- **THEN** the UI shows empty-state copy inviting a user message, with the bottom composer visible and without a persistent right-hand parameter panel

#### Scenario: Advanced holds primary knobs
- **WHEN** the user opens「高级」
- **THEN** System Prompt, Temperature, Max tokens, and Stream controls are available there and closing高级 returns focus to the conversation layout

### Requirement: Model parameters apply on send
Changing model (composer), thinking depth (when visible), or advanced parameters (temperature, max tokens, stream, system prompt) SHALL apply on the next send without a separate modal confirmation.

#### Scenario: Model select
- **WHEN** the user selects a gateway model alias in the composer and sends a message
- **THEN** the chat request uses that model id

#### Scenario: Advanced temperature applies
- **WHEN** the user changes Temperature in「高级」and sends a message
- **THEN** the chat request includes the updated temperature value

## ADDED Requirements

### Requirement: Composer-first toolbar
The bottom composer SHALL include clear-chat and send (or stop while generating) actions, a model selector, and—when the model supports thinking—the thinking-depth stepper. Optional secondary actions such as「查看代码」MAY appear as non-primary toolbar controls but MUST NOT restore a persistent right-hand config column.

#### Scenario: Composer send path
- **WHEN** the user types a message and activates send
- **THEN** the message is appended to the stream and a chat request is issued using the composer model and current advanced settings
