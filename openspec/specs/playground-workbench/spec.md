## Purpose

Defines the `/playground` conversation-test workbench: composer-first chat, advanced parameters, streaming output, and view-code snippets against the gateway.

## Requirements

### Requirement: Debug workbench layout
The `/playground` page SHALL present a conversation-test workbench: a role-labeled message stream (not chat bubbles), a bottom composer containing the prompt field plus toolbar actions (new conversation, thinking depth when supported, model select, send), and a token summary. Prior conversations SHALL be reachable from a collapsible history list on the left. System Prompt, Temperature, Max tokens, and Stream MUST NOT occupy the first viewport; they SHALL be reachable only via an「高级」entry. The page MUST NOT show a persistent right-hand parameter panel on the primary layout.

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

### Requirement: Composer-first toolbar
The bottom composer SHALL include a new-conversation action and send (or stop while generating) actions, a model selector, and—when the model supports thinking—the thinking-depth stepper. The new-conversation action SHALL keep prior conversations available in history. Optional secondary actions such as「查看代码」MAY appear as non-primary toolbar controls but MUST NOT restore a persistent right-hand config column.

#### Scenario: Composer send path
- **WHEN** the user types a message and activates send
- **THEN** the message is appended to the stream and a chat request is issued using the composer model and current advanced settings

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

### Requirement: Recoverable conversation history
The workbench SHALL persist each signed-in user's conversations and restore a selected conversation, including its messages, model, and advanced settings, after a refresh. A user MUST NOT be able to read or mutate another user's conversation. Starting a new conversation MUST retain earlier ones. Deleting a conversation MUST remove it from that user's history.

#### Scenario: Resume after refresh
- **WHEN** the user sends a message, reloads `/playground`, and opens that conversation from history
- **THEN** the previous user and assistant messages are shown and a further send continues the same conversation

#### Scenario: Other user's conversation
- **WHEN** a request names a conversation id that belongs to a different user
- **THEN** the server responds as if the conversation does not exist and does not return its messages

### Requirement: Server-packed context
On send, the client SHALL submit the new user message and the current settings. The server SHALL build the model context in this order: the conversation system prompt, active long-term memories, the rolling summary of older turns, any older turns the summary has not covered yet, then the most recent six messages. The newest user message MUST remain in the context. Images from earlier turns MUST NOT be sent again. The「查看代码」example SHALL stay a raw gateway request and MUST NOT include injected memory or summary text.

#### Scenario: Long thread is compressed
- **WHEN** the conversation has more than six messages and a rolling summary exists
- **THEN** the upstream chat request contains the summary and the recent window, and omits messages already covered by the summary

### Requirement: Automatic long-term memory
After a completed assistant reply, the server SHALL ask a low-cost model to extract stable facts and store them for that user only. Facts that contain secrets, passwords, or verification codes MUST NOT be stored. Active facts SHALL be injected on later turns in this user's playground conversations. The user SHALL be able to delete one fact or clear all of them, and deleted facts MUST NOT be injected afterward. Summary and memory calls SHALL be recorded on the user's spend ledger with a kind distinct from ordinary chat.

#### Scenario: Secret is dropped
- **WHEN** extraction proposes a fact that contains an API key, password, or verification code
- **THEN** that fact is not stored and is not injected later

#### Scenario: Stopped generation is kept
- **WHEN** the user stops an in-flight streamed reply
- **THEN** the partial assistant text is stored on the conversation with status aborted
