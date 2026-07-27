## Purpose

Defines the `/playground` open-platform debug workbench: message stream, model parameters, streaming output, and view-code snippets against the gateway.

## Requirements

### Requirement: Debug workbench layout
The `/playground` page SHALL present an open-platform debug workbench: collapsible System Prompt, message stream labeled by role (not chat bubbles), right-hand model parameter panel (~300px), bottom composer, and token summary strip.

#### Scenario: Empty conversation
- **WHEN** the user opens playground with no messages
- **THEN** the UI shows empty-state copy inviting a user message and optional System Prompt edit, with the parameter panel visible

### Requirement: Model parameters apply on send
Changing model, temperature, max tokens, or stream toggle in the parameter panel SHALL be applied on the next send without a separate modal confirmation.

#### Scenario: Model select
- **WHEN** the user selects a gateway model alias and sends a message
- **THEN** the chat request uses that model id

### Requirement: Streaming assistant output
Assistant responses SHALL stream into the message list with a trailing caret while generating, and the user MUST be able to stop an in-flight generation when streaming is active.

#### Scenario: Stream tokens
- **WHEN** the gateway returns an SSE chat stream
- **THEN** assistant content updates incrementally in the message stream

### Requirement: View code snippet
The workbench SHALL offer「查看代码」that opens a dialog with an OpenAI-compatible curl or SDK snippet targeting this gateway base URL and the currently selected model.

#### Scenario: Open snippet
- **WHEN** the user activates「查看代码」
- **THEN** a dialog shows a copyable request example using the gateway `/v1` base URL placeholder or configured public base URL
