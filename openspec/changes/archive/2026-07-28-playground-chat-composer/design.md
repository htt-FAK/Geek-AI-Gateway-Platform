## Context

`/playground` 当前实现（`playground-inner.tsx`）采用中列消息流 + 右侧 ~300px「模型配置」栏（模型 / Temperature / Max tokens / Stream），System Prompt 占顶栏。探索结论要求：只改对话测试页；排版参考对话测试 composer；样式保持 Minimal dark；思考深度按 DeepSeek / MiMo 官方能力；Flash / ASR / TTS 隐藏滑杆；`reasoning_content` 单独折叠；Temperature 等完全移出首屏进「高级」。

上游约束（官方）：

- DeepSeek：`thinking.type` = `enabled|disabled`；`reasoning_effort` = `high|max`（`low`/`medium`→`high`，`xhigh`→`max`）；思维链在 `reasoning_content`。
- MiMo：仅 `thinking.type` = `enabled|disabled`；无官方 effort 档；流式先 `reasoning_content` 再 `content`。

## Goals / Non-Goals

**Goals:**

- Composer 化首屏：消息流 + 底部输入工具条（清空、思考深度、模型、发送）。
- 「高级」收纳 Temperature、Max tokens、Stream、System Prompt（及查看代码可保留为次要入口）。
- 思考深度离散滑杆 + 按模型映射请求字段；不支持模型隐藏控件。
- 流式/非流式解析并折叠展示 `reasoning_content`。
- BFF 透传 thinking 相关字段。

**Non-Goals:**

- 侧栏 IA / 其它子页面重构。
- 附件上传、多会话历史、Tool call UI。
- 伪造 Codex 五档（超出上游真实档位）。
- 改 LiteLLM 路由或上游模型目录本身。

## Decisions

### 1. 布局：去掉右侧栏，首屏只留对话主路径

- **选择**：删除常驻右侧参数栏；composer 承载模型与思考深度；其它参数进「高级」抽屉/面板。
- **理由**：对齐对话测试排版，首屏只服务「选模型 → 调思考 → 发消息」。
- **备选**：保留右侧栏仅缩窄 —— 否决，与「完全移出首屏」冲突。

### 2. 「高级」内容与入口

- **选择**：composer 或消息区工具行提供「高级」按钮，打开抽屉/Dialog，内含 System Prompt、Temperature、Max tokens、Stream；「查看代码」可放在高级内或工具行次要位置。
- **理由**：参数仍可调，但不占主视口。
- **默认值**：Temperature `0.7`、Max tokens `1024`、Stream `true`（与现网一致）；思考开启时 Temperature 对 DeepSeek 无效但不报错（官方兼容行为），UI 仍可显示但可加说明。

### 3. 思考深度档位（按模型动态 stops）

| UI 档 | DeepSeek Pro | MiMo Pro / UltraSpeed /（可选）V2.5 |
|-------|--------------|-------------------------------------|
| 关闭 | `thinking.disabled` | `thinking.disabled` |
| 标准 / 开启 | `enabled` + `reasoning_effort=high` | `thinking.enabled` |
| 极深 | `enabled` + `reasoning_effort=max` | （无此档；滑杆仅两档） |

- **隐藏滑杆**：`deepseek-v4-flash`、`mimo-v2.5-asr`、全部 `mimo-v2.5-tts*`。
- **UI**：步进滑杆（吸附档位 + 当前档名），形态参考 Codex，档数跟模型走。
- **备选**：统一五档再 fold —— 否决，会造成假反馈。

### 4. 消息模型与流式解析

- Assistant 消息扩展为 `{ role, content, reasoningContent? }`。
- SSE：累计 `delta.reasoning_content` 与 `delta.content` 分开；UI 先/并行更新折叠块与正文。
- 折叠块默认收起；生成中若仅有 reasoning 可自动展开或显示「思考中…」指示，完成后可保持折叠（实现时取：生成中展开指示、结束后默认折叠）。
- 多轮回传：无 tool 时可不把历史 `reasoning_content` 送回（DeepSeek 文档）；首期 playground 无 tools，按「不回传历史 reasoning」简化，除非后续加 tools。

### 5. BFF 透传

- `/api/chat` body 增加可选：`thinking?: { type: 'enabled'|'disabled' }`、`reasoning_effort?: 'high'|'max'`。
- 转发到 LiteLLM `chat/completions`；Flash/无思考模型前端不发这些字段。
- 查看代码 snippet 同步带上当前 thinking 相关字段。

### 6. 视觉

- 使用现有 Minimal token（`--bg-*`、`--border-*`、`--radius-md`）；composer 为 elevated 表面，非亮色卡片山寨。
- 消息仍按 role 标签，禁止聊天气泡。

## Risks / Trade-offs

- [LiteLLM 对 `thinking` / `reasoning_effort` 透传不完整] → 用真实 Pro 模型冒烟；必要时在 gateway 层确认 drop 行为。
- [MiMo 两档 vs DeepSeek 三档，用户困惑] → 滑杆旁文案随模型切换（「开启」vs「标准/极深」）。
- [思考模式忽略 temperature 但高级里仍可调] → 高级内短提示「思考开启时部分采样参数可能被上游忽略」。
- [流式 reasoning 与 content 交错解析脆弱] → 按官方「先 reasoning 后 content」顺序累计；两者字段独立拼接。

## Migration Plan

- 纯前端 + BFF 行为变更，无 DB 迁移。
- 部署后旧书签 `/playground` 仍有效；无右侧栏为预期 UX 变化。
- 回滚：还原 `playground-inner` 与 `chat/route` 即可。

## Open Questions

- `mimo-v2.5`（全模态）是否展示两档滑杆：默认 **展示**；若联调无 `reasoning_content` 再改为隐藏。
- 「查看代码」最终放在工具行还是「高级」内：默认 **工具行次要按钮**，与清空并列，避免埋太深。
