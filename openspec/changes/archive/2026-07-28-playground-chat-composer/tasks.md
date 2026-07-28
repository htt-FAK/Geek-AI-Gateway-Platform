## 1. Chat API thinking pass-through

- [x] 1.1 Extend `/api/chat` body schema with optional `thinking` and `reasoning_effort`
- [x] 1.2 Forward those fields to LiteLLM `chatCompletions` request body
- [x] 1.3 Ensure streaming path still returns upstream SSE unchanged for `reasoning_content` deltas

## 2. Thinking depth model mapping

- [x] 2.1 Add helper mapping model id → slider stops (DeepSeek Pro 3-stop, MiMo thinking 2-stop, Flash/ASR/TTS none)
- [x] 2.2 Map UI stop → request payload (`thinking` / `reasoning_effort`)
- [x] 2.3 Unit-test or smoke-assert mapping table for catalog text models

## 3. Playground composer layout

- [x] 3.1 Remove persistent right-hand parameter panel from `playground-inner`
- [x] 3.2 Rebuild bottom composer: textarea, clear, model select, send/stop, token strip
- [x] 3.3 Add「高级」entry hosting System Prompt, Temperature, Max tokens, Stream
- [x] 3.4 Keep「查看代码」as secondary toolbar action; include thinking fields in snippet when active
- [x] 3.5 Apply Minimal dark tokens; no chat bubbles; role-labeled stream retained

## 4. Thinking depth UI + reasoning fold

- [x] 4.1 Add discrete thinking-depth stepper in composer; hide when model unsupported
- [x] 4.2 Extend message state with `reasoningContent`; parse stream/non-stream into reasoning vs content
- [x] 4.3 Render collapsible「思考过程」above assistant answer
- [x] 4.4 Wire send payload with current thinking mapping + advanced params

## 5. Verify

- [x] 5.1 Manual: DeepSeek Pro 关闭/标准/极深 + folded reasoning stream
- [x] 5.2 Manual: MiMo Pro 关闭/开启；Flash/ASR 无滑杆
- [x] 5.3 Manual:「高级」改 temperature/max_tokens/stream/system 后下次发送生效；首屏无右侧栏
