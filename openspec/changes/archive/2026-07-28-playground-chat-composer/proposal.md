## Why

当前 `/playground` 仍是右侧参数栏 + 底栏输入的开放平台调试台形态，首屏挤满 Temperature / Max tokens / Stream 等控件，不利于「对话测试」主路径。需要按对话测试排版重构为 composer 工作台，并按 DeepSeek / MiMo 官方思考能力接入思考深度与可折叠思维链展示。

## What Changes

- 将 `/playground` 重构为对话测试布局：消息流 + 底部 composer（输入、清空、思考深度、模型、发送）；去掉首屏右侧参数栏。
- Temperature、Max tokens、Stream、System Prompt 等完全移出首屏，收入「高级」入口（抽屉/面板），不占用主对话区。
- 新增离散「思考深度」步进滑杆：档位按 DeepSeek / MiMo 官方真实能力映射；`deepseek-v4-flash` 与 ASR/TTS 模型选中时隐藏滑杆。
- 助手消息支持 `reasoning_content`：思考过程单独折叠展示，与最终 `content` 分流（含流式）。
- BFF `/api/chat` 透传 `thinking`（及 DeepSeek 的 `reasoning_effort`），并解析流式/非流式中的 `reasoning_content`。
- 本 change **不**改侧栏 IA、其它子页面、附件上传。

## Capabilities

### New Capabilities

- `thinking-depth`: 思考深度控件可见性与档位映射、请求透传、以及助手消息中思考过程的折叠展示。

### Modified Capabilities

- `playground-workbench`: 调试台布局从「中列 + 右侧参数栏」改为「消息流 + 底部 composer」；首屏参数迁入「高级」；保留清空、查看代码、流式停止与 token 摘要等核心能力。

## Impact

- 前端：`web/src/app/playground/playground-inner.tsx` 及样式；可能新增思考深度/折叠块小组件。
- API：`web/src/app/api/chat/route.ts`、`web/src/lib/litellm.ts`（请求体字段与流式 delta 解析）。
- 规格：更新 `playground-workbench`；新增 `thinking-depth`。
- 不影响登录页、侧栏导航结构、其它控制台页面。
