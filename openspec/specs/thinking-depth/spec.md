## Purpose

Defines thinking-depth controls in the playground and chat API: model-aware effort stops, hiding unsupported models, collapsible reasoning content, and upstream parameter forwarding.

## Requirements

### Requirement: Thinking depth control by model capability
The playground SHALL expose a discrete thinking-depth stepper in the composer toolbar when the selected model supports thinking. DeepSeek Pro SHALL offer three stops mapped to official controls: 关闭 (`thinking.type=disabled`), 标准 (`thinking.type=enabled` + `reasoning_effort=high`), 极深 (`thinking.type=enabled` + `reasoning_effort=max`). MiMo text models and GLM-4.7 that support thinking SHALL offer two stops: 关闭 (`thinking.type=disabled`) and 开启 (`thinking.type=enabled`). GLM-5.3 / GLM-5.3-Flash SHALL offer three effort stops and MUST NOT expose 关闭, because upstream rejects `thinking.type=disabled`: 轻度 (`enabled` + `reasoning_effort=low`), 标准 (`enabled` + `high`), 极深 (`enabled` + `max`). The control MUST NOT invent effort levels beyond upstream-documented values.

#### Scenario: DeepSeek Pro three-stop slider
- **WHEN** the user selects `deepseek-v4-pro` and adjusts thinking depth to 极深 then sends
- **THEN** the chat request includes `thinking.type=enabled` and `reasoning_effort=max`

#### Scenario: MiMo two-stop slider
- **WHEN** the user selects `mimo-v2.5-pro` and sets thinking depth to 开启 then sends
- **THEN** the chat request includes `thinking.type=enabled` and MUST NOT require a `reasoning_effort` value for correctness

#### Scenario: GLM-4.7 two-stop slider
- **WHEN** the user selects `glm-4.7` and sets thinking depth to 开启 then sends
- **THEN** the chat request includes `thinking.type=enabled` and MUST NOT include `reasoning_effort`

#### Scenario: GLM-5.3 forced-thinking effort slider
- **WHEN** the user selects `glm-5.3` and sets thinking depth to 极深 then sends
- **THEN** the chat request includes `thinking.type=enabled` and `reasoning_effort=max` and MUST NOT send `thinking.type=disabled`

### Requirement: Hide thinking depth for unsupported models
When the selected model is `deepseek-v4-flash`, any ASR model, or any TTS model, the playground SHALL hide the thinking-depth control and MUST NOT send thinking-related fields on the next chat request.

#### Scenario: Flash hides slider
- **WHEN** the user selects `deepseek-v4-flash`
- **THEN** the thinking-depth stepper is not visible in the composer

#### Scenario: ASR hides slider
- **WHEN** the user selects `mimo-v2.5-asr`
- **THEN** the thinking-depth stepper is not visible in the composer

### Requirement: Collapsible reasoning content
Assistant messages that include thinking output SHALL present `reasoning_content` in a separate collapsible section above the final answer content. The final answer MUST remain visible independently of whether the reasoning section is expanded.

#### Scenario: Fold reasoning after response
- **WHEN** an assistant message contains both reasoning and content
- **THEN** the UI shows a collapsible「思考过程」block and the answer body, and collapsing the block does not hide the answer

#### Scenario: Stream reasoning separately
- **WHEN** the gateway streams `delta.reasoning_content` then `delta.content`
- **THEN** the playground accumulates them into the reasoning section and answer body respectively

### Requirement: Chat API forwards thinking parameters
The `/api/chat` endpoint SHALL accept optional `thinking` and `reasoning_effort` fields and forward them to the gateway chat completions call for authorized users within budget, alongside existing model/messages/stream/max_tokens/temperature fields.

#### Scenario: Forward thinking payload
- **WHEN** the client posts a valid chat body with `thinking.type=enabled` and `reasoning_effort=high`
- **THEN** the upstream request includes those fields
