# AI 网关平台 · 前端设计规范

> 版本：1.7
> 更新日期：2026-07-24
> 产品英文名：AI Gateway Platform
> 设计代号：**精密仪器操作台**（开放平台调试台气质 × 网关控制台身份）
>
> **参考分层（勿再混淆）：**
>
> | 页面 | 参考 | 学什么 |
> |------|------|--------|
> | `/login` 进入页 | [Hermes/Nous Portal](https://portal.nousresearch.com/manage-subscription) + [Moonshot.ai](https://www.moonshot.ai/) | 史诗体量 + 哲学宣言与留白 |
> | `/playground` **主工作台** | **[Kimi 开放平台 Playground](https://platform.kimi.com/playground)** | 开发者调试台：System Prompt、参数侧栏、消息流、Token 统计、查看代码 |
>
> **纠正说明：** 「Kimi 风格」指的是 **platform.kimi.com/playground 开发工作台**，**不是** kimi.com C 端聊天页，也不是仅「无气泡对话排版」。
> 用途：后续前端实现的**唯一视觉与交互依据**；可随工程拷贝至 `docs/`。
> **v1.7：** 样式优化补丁——钢青主色、双密度、Logo 锚点、文档站阅读版式、图表中性色、细节令牌；**`/` 与 `/login` 合并为同一进入页**。

---

## 0. 文档说明

### 0.1 读者

- 前端工程师（Next.js 实现）
- 参与评审的产品 / 设计同学
- 后续 AI 辅助编码时的上下文输入

### 0.2 与工程的关系

| 文档 | 职责 |
|------|------|
| 本规范 | 视觉、布局、组件、动效、文案、**接入文档 IA（§1.6）**、Do/Don't |
| 开发文档（若存在） | LiteLLM、config、分期后端能力 |
| 对外接入文档站 | 部署于 `{{DOCS_BASE_URL}}`，内容按 §1.6 |

本规范**自包含**路由与页面结构，即使开发文档不在同目录也可单独使用。

### 0.3 技术映射（已锁定）

| 层 | 选型 |
|----|------|
| 框架 | Next.js 15（App Router）+ TypeScript |
| 样式 | Tailwind CSS v4 + CSS 变量设计令牌 |
| 原语 | Radix UI（自研皮肤，不套默认 shadcn 主题） |
| 动效 | Motion（原 Framer Motion），仅规定的 3 处主推 |
| 字体 | Instrument Sans（展示）/ Geist Sans（界面）/ IBM Plex Mono（代码） |
| 图标 | Lucide，细线，24px 导航 / 16–20px 行内 |
| 对话流式 | Vercel AI SDK |
| 图表 | Recharts（P2 数据看板） |
| 代码高亮 | Shiki，暗色系（One Dark Pro 取向） |

---

## 1. 设计原则

用一句话概括目标气质：

> **像一台精密仪器的操作面板——暗色但不压抑，信息清楚但不拥挤，交互安静且被尊重。**

| 原则 | 含义 | 验收标准 |
|------|------|----------|
| **克制** | 约 95% 灰阶 + 约 5% 强调色 | 任意截图，强调色像素占比目测不超过一角 |
| **呼吸感** | 留白优先于装饰；**进入页用 Marketing 密度** | 进入页区块间距 ≥ 24px；控制台用 App 密度 20–24px padding |
| **精致** | 靠对齐、字阶、1px 分割，不靠光晕堆砌 | 禁止大面积 glow；允许极弱噪点与 1px 顶线 |
| **流畅** | 动效短、缓出、不弹跳 | 主推动效 150–200ms，`ease-out` |
| **内容优先** | 调试与参数是主角 | Playground 是开放平台工作台；落地/登录首屏无卡片墙 |
| **身份清晰** | 这是网关 / API 平台，不是 C 端聊天 App | 登录后是控制台 + 调试台；未登录是品牌进入页 |

### 1.1 明确反对的审美惯性

- 大面积紫白 / 紫靛渐变、荧光描边、多层阴影
- Hero 内统计条、模型卡片墙、浮动徽章
- 把 Playground 做成 C 端聊天 App（无 System Prompt、无参数侧栏、无 Token/代码面板）
- 传统聊天气泡（圆角色块对聊）作为默认消息样式
- 整站依赖「发光」制造高级感

---

## 1.5 品牌与全站文案体系

### 1.5.1 品牌层级（已锁定）

| 层级 | 中文 | 英文 | 出现位置 |
|------|------|------|----------|
| 组织 / 工作室 | **高科极客工作室** | **Geek** | 页脚、关于、登录页签名 |
| 产品 | **AI 网关** / AI 网关平台 | **AI Gateway** | 顶栏产品名、浏览器标题、登录宣言区 |
| 完整署名 | 高科极客工作室 · AI 网关 | Geek · AI Gateway | 关于页、文档扉页 |

**显示规则：**

- 顶栏 Logo 旁优先写 **AI Gateway**（产品）；副标或 hover 可出「Geek」。  
- 登录页左下或宣言下方固定工作室签名：**Geek · 高科极客工作室**。  
- 不要把「高科极客工作室」做成比产品名更大的 Display 字——工作室是出品方，产品是主角。

### 1.5.2 口号定稿

原句「一群有趣的人，做有趣的事」意思对，但「一群」使前后音节不齐，略拗口。

| 用途 | 文案 | 说明 |
|------|------|------|
| **主口号（定稿）** | **有趣的人，做有趣的事** | 五字对五字，更顺口；作工作室签名句 |
| 英文主口号 | **Interesting people. Interesting work.** | 与中文对仗；用于英文 UI / 页脚 |
| 短标签（侧栏底/徽章） | **Geek · 有趣做事** | 极窄空间 |
| 备选（更极客） | 认真玩，玩出真东西 | 若品牌要更「工作室」可换用，全站只保留一句主口号 |
| 弃用 | 一群有趣的人，做有趣的事 | 仅作历史备忘，界面不再使用 |

**口号与产品宣言的分工：**

- **工作室口号**（有趣的人，做有趣的事）：人味、态度，放登录签名、页脚、关于。  
- **产品宣言**（一个入口，调度所有大模型）：能力、价值，放登录主标题。  
- 二者可同页出现，但**字号上产品宣言 ≫ 工作室口号**。

### 1.5.3 语气

- 短句、肯定句；少感叹号、少「赋能」「一站式闭环」空话。  
- 开发者向：说清能做什么；工作室向：留一句人味即可。  
- 中英文可混排产品名（AI Gateway），正文以中文为主。

### 1.5.4 登录页 `/login` 文案（完整稿）

```text
顶栏左：Geek                    顶栏右：文档

左栏主标题（Display XL）：
  一个入口，调度所有大模型

左栏支撑（最多 2 行）：
  统一转发 DeepSeek 与 MiMo。
  OpenAI 兼容，密钥与用量归一。

左栏旁注（Small）：
  DeepSeek V4 · MiMo V2.5

左栏签名（Small / tertiary，靠近底部）：
  Geek · 高科极客工作室
  有趣的人，做有趣的事

右栏面板标题：
  进入 AI Gateway

右栏字段标签：
  网关密钥（或：账号 / 密码）

右栏主按钮：
  进入

右栏次要：
  还没有密钥？查看文档
```

**哲思向备选主标题（二选一，勿并存）：**

| 方案 | 主标题 | 何时用 |
|------|--------|--------|
| A（定稿，偏产品） | 一个入口，调度所有大模型 | 默认 |
| B（偏工作室气质） | 把算力，收成一条干净的入口 | 若更想 Moonshot 刊头感 |

### 1.5.5 各子页面文案

#### 顶栏 / 壳层共用

| 位置 | 文案 |
|------|------|
| 产品名 | AI Gateway |
| 文档链 | 文档 → `{{DOCS_BASE_URL}}`（新标签） |
| 用户菜单 | 账户 / 退出 |
| 侧栏导航 | 调试台 · 看板 · 模型 · 密钥 |
| 侧栏底版本 | v0.1.0 |
| 侧栏底签名（可选） | Geek |
| 全局页脚（若有） | © 高科极客工作室 Geek · 有趣的人，做有趣的事 |

导航英文并存时：`Playground` / `Dashboard` / `Models` / `Keys`；中文 UI 用上表「调试台 · 看板」等。`/usage` 重定向至 `/dashboard`。

#### `/playground` 调试台

| 位置 | 文案 |
|------|------|
| 页面标题（若显示） | 调试台 |
| 页面副标题 | 调模型、看参数、验网关是否按你想的在跑 |
| System Prompt 折叠摘要 | System Prompt · 点击编辑 |
| System Prompt 占位 | 设定助手的角色、口吻与边界。例如：你是严谨的 API 助手，回答简短、先给结论。 |
| 参数面板标题 | 模型配置 |
| 模型标签 | 模型 |
| 空消息态标题 | 还没有回合 |
| 空消息态说明 | 在下方写一句 user 消息；需要人设时先展开 System Prompt。 |
| 空消息态暗示 | 试试：「用一句话说明你是哪个模型。」 |
| 工具条 | 清空 · 查看代码 |
| 查看代码对话框标题 | 调用示例 |
| 查看代码说明 | 指向本网关的 OpenAI 兼容请求，可直接粘贴到你的项目里。 |
| 输入占位 | 输入 user 消息… |
| 发送 | 发送 |
| Token 条前缀 | Tokens |
| Token 格式 | in {n} · out {n} · total {n} |
| 发送中 | 生成中… |
| 停止 | 停止 |
| 错误条 | 请求失败。检查密钥、模型名或网关是否在线。 |

#### `/models` 模型

| 位置 | 文案 |
|------|------|
| 标题 | 模型 |
| 副标题 | 当前网关已挂上的上游能力 |
| 状态句（有模型） | 已接入 {n} 个模型 |
| 状态句（全健康） | 已接入 {n} 个模型，运行正常 |
| 行次要信息模板 | {能力简述} · 上下文 {窗口} |
| 状态：正常 | 正常 |
| 状态：异常 | 不可用 |
| 操作 | 在调试台试用 · 文档 · 详情 |
| 空态标题 | 还没有模型 |
| 空态说明 | 去网关 `config.yaml` 挂上 §1.6.2 中的模型，然后回到这里刷新。 |
| 空态按钮 | 打开调试台 |

#### `/keys` 密钥（P2）

| 位置 | 文案 |
|------|------|
| 标题 | 密钥 |
| 副标题 | 给人或给程序发一张进网关的通行证 |
| 主按钮 | 创建密钥 |
| 表头 | 名称 · 密钥 · 创建时间 · 操作 |
| 创建对话框标题 | 创建密钥 |
| 名称占位 | 例如：本地开发、CI、同事-张三 |
| 创建确认 | 创建 |
| 创建成功提示 | 请立即复制完整密钥，关闭后无法再看明文。 |
| 空态标题 | 还没有密钥 |
| 空态说明 | 创建一张，就能在 SDK 里把 baseURL 指到本网关。 |
| 吊销确认 | 吊销后，使用该密钥的请求会立即失败。确定吊销？ |

#### `/dashboard` 看板（P2；原 `/usage` 升级）

| 位置 | 文案 |
|------|------|
| 标题 | 看板 |
| 副标题 | 网关跑得怎样，一眼看完 |
| 时间范围 | 近 24 小时 · 近 7 天 · 近 30 天 |
| KPI | 总请求 / 总 Token / 预估费用 / 错误率 / 缓存命中率 / P95 延迟 |
| 缓存未启用 | 未启用 |
| 主图标题 | 调用趋势 |
| 次图标题 | 缓存命中 |
| 表：失败 | 近期失败 |
| 表：Key | 调用最多的密钥 |
| 空态标题 | 还没有数据 |
| 空态说明 | 去调试台跑几轮，或等流量进来后再看。 |
| 兼容说明 | 书签 `/usage` 应重定向到本页 |

#### 空态 / 错误 / 权限（全局）

| 场景 | 文案 |
|------|------|
| 401 | 密钥无效或未登录。请重新进入。 |
| 403 | 没有权限访问该资源。 |
| 502/上游失败 | 上游模型暂时不可用，请换模型或稍后重试。 |
| 网络错误 | 连不上网关。确认服务已启动且地址正确。 |
| 通用重试 | 重试 |

### 1.5.6 浏览器标题模板

| 页面 | `document.title` |
|------|------------------|
| 登录 | 进入 · AI Gateway · Geek |
| 调试台 | 调试台 · AI Gateway |
| 模型 | 模型 · AI Gateway |
| 密钥 | 密钥 · AI Gateway |
| 看板 | 看板 · AI Gateway |

### 1.5.7 文案验收

1. 登录页是否能同时读出：**产品一句话** + **Geek 签名口号**（口号更小）？  
2. 任一子页副标题是否在说「这一页干什么」，而不是重复口号？  
3. 是否出现「赋能」「全方位」「新一代颠覆」等空话？（应无）  
4. 中英文产品名是否统一为 AI Gateway，工作室是否统一为 Geek / 高科极客工作室？
5. 看板是否含缓存命中率，且未开缓存时为「未启用」？
6. 接入文档示例是否使用本网关 `{{GATEWAY_BASE_URL}}/v1`，模型 ID 是否与 §1.6.2 一致？
7. 主按钮/选中条是否为钢青，而非 DeepSeek/MiMo 品牌色？



## 1.6 接入文档设计

> 文档站对外地址部署前一律使用占位符；控制台「文档」链到同一基址。  
> 内容骨架对齐 [DeepSeek API Docs](https://api-docs.deepseek.com/zh-cn/) 与 [MiMo Docs](https://mimo.mi.com/docs/zh-CN/quick-start/summary/welcome)，品牌与入口改为 **Geek · AI Gateway**。

### 1.6.1 占位符约定

| 占位符 | 含义 | 填入时机 |
|--------|------|----------|
| `{{DOCS_BASE_URL}}` | 接入文档站根地址（无尾斜杠） | 文档部署后 |
| `{{GATEWAY_BASE_URL}}` | 网关 API 主机根，例如 `https://gateway.example.com` | 网关上线后 |
| `{{API_KEY}}` | 用户在本平台创建的网关密钥 | 示例中用环境变量名展示 |

**示例中的 OpenAI 兼容地址统一写为：** `{{GATEWAY_BASE_URL}}/v1`  
**鉴权：** `Authorization: Bearer {{API_KEY}}`（或环境变量 `AI_GATEWAY_API_KEY`）

控制台顶栏「文档」、登录页「查看文档 / 还没有密钥？查看文档」→ 打开 `{{DOCS_BASE_URL}}`（新标签）。

### 1.6.2 网关对外模型清单（定稿）

文档与 `/models`、调试台下拉共用下列 **model ID**（经 LiteLLM 转发上游；若 config 使用别名，文档须同步别名表）。

#### DeepSeek · 文本

| Model ID | 说明（文档一句话） |
|----------|-------------------|
| `deepseek-v4-flash` | 更快、更省的 V4 文本模型 |
| `deepseek-v4-pro` | 更强的 V4 旗舰文本模型 |

> 官方曾用 `deepseek-chat` / `deepseek-reasoner` 等旧名；**本网关文档与示例默认只用上表 V4 ID**（与 [DeepSeek 现网文档](https://api-docs.deepseek.com/zh-cn/) 对齐）。

#### MiMo · 文本

| Model ID | 说明 |
|----------|------|
| `MiMo-V2.5-Pro` | 文本旗舰 |
| `MiMo-V2.5-Pro-UltraSpeed` | 文本旗舰 · 更高速度档 |

#### MiMo · 全模态

| Model ID | 说明 |
|----------|------|
| `MiMo-V2.5` | 全模态（图文等，能力以上游为准） |

#### MiMo · 语音

| Model ID | 说明 |
|----------|------|
| `MiMo-V2.5-ASR` | 语音识别 |
| `MiMo-V2.5-TTS` | 语音合成 |
| `MiMo-V2.5-TTS-VoiceClone` | 音色克隆 |
| `MiMo-V2.5-TTS-VoiceDesign` | 音色设计 |

登录页旁注缩写：**DeepSeek V4 · MiMo V2.5**（不必枚举全部 ID）。

### 1.6.3 文档站信息架构

```text
{{DOCS_BASE_URL}}/
├── /                         # 欢迎 / 概述
├── /quickstart/get-key       # 获取密钥
├── /quickstart/first-call    # 第一次调用
├── /models                   # 模型总览
├── /models/deepseek          # DeepSeek
├── /models/mimo              # MiMo（锚点：文本 / 全模态 / 语音）
├── /api/chat-completions     # Chat Completions
├── /api/streaming            # 流式输出
├── /api/thinking             # 思考 / 推理参数（DeepSeek）
├── /api/multimodal-audio     # （P2）语音 / 多模态端点
├── /guides/openai-sdk        # 接入案例：OpenAI SDK
├── /guides/agents            # Agent / 编程工具改 base_url
├── /guides/errors            # 错误码与排障
└── /changelog                # 更新日志
```

侧栏分组标题：**快速开始** · **模型** · **API 参考** · **接入案例** · **更新日志**。  

**文档站视觉（阅读版式，已锁定）：**

- 复用本规范深色色板与钢青强调色；**不做**与控制台 1:1 同密度。
- 布局：左文档导航 **240–280px** + 正栏最大宽 **720–760px**（舒适行长）+ 可选右 TOC。
- 正文 15px、行高 **1.7**；标题区上下留白大于控制台 App 密度。
- 代码块占比更高：`--bg-surface` + IBM Plex Mono + Shiki；行号默认关。
- 壳可用略亮一层的内容面（正栏坐在 `bg-elevated` 上），避免整页死黑导致长文疲劳。
- 顶栏仅 Logo + 回控制台 + 搜索（P2）；无调试台式多工具按钮。

### 1.6.4 各页文案与必备块

#### 欢迎 `/`

| 项 | 内容 |
|----|------|
| 标题 | AI Gateway 接入文档 |
| 一句话 | 用 OpenAI 兼容协议，经 Geek 网关调用 DeepSeek 与 MiMo。 |
| 出品 | 高科极客工作室 · Geek |
| 主 CTA | 第一次调用 → `/quickstart/first-call` |
| 次 CTA | 查看模型 → `/models` |
| 必备三要素卡片 | Base URL · API Key · Model |

#### 获取密钥 `/quickstart/get-key`

| 项 | 内容 |
|----|------|
| 标题 | 获取密钥 |
| 步骤 | 1. 登录 AI Gateway 控制台 2. 打开「密钥」创建密钥 3. 复制一次明文 |
| 提示 | 密钥只显示一次；丢失请吊销后重建。 |
| 链到控制台 | `{{GATEWAY_BASE_URL}}` 的控制台地址（占位，部署后填） |

#### 第一次调用 `/quickstart/first-call`

结构仿 DeepSeek「首次调用」：先给配置表，再给 curl / Python / Node 三栏。

**配置表**

| PARAM | VALUE |
|-------|-------|
| base_url (OpenAI SDK) | `{{GATEWAY_BASE_URL}}/v1` |
| api_key | 控制台创建的网关密钥 |
| 推荐试跑 model | `deepseek-v4-flash` 或 `MiMo-V2.5-Pro` |

**curl 示例骨架**

```bash
curl {{GATEWAY_BASE_URL}}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

**Python 示例骨架**

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["AI_GATEWAY_API_KEY"],
    base_url="{{GATEWAY_BASE_URL}}/v1",
)

resp = client.chat.completions.create(
    model="MiMo-V2.5-Pro",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)
```

**Node 示例骨架**

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: "{{GATEWAY_BASE_URL}}/v1",
});

const completion = await client.chat.completions.create({
  model: "deepseek-v4-flash",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(completion.choices[0].message.content);
```

页内注明：流式将 `stream: true`；DeepSeek 思考模式参数见 `/api/thinking`。

#### 模型总览 `/models`

- 分组表：DeepSeek 文本 | MiMo 文本 | MiMo 全模态 | MiMo 语音（ID 同 §1.6.2）。  
- 每行链到分组页锚点。  
- 一句话：在请求里把 `model` 设为表中 ID，其余走 OpenAI Chat Completions。

#### DeepSeek / MiMo 模型页

- 列出该组全部 ID + 适用场景一句。  
- 「在调试台试用」链到控制台 `/playground`（占位主机）。  
- 能力细节可链官方文档作「上游说明」，但 **调用地址必须写本网关**。

#### API：Chat Completions `/api/chat-completions`

| 项 | 内容 |
|----|------|
| 标题 | 对话补全 |
| 方法 | `POST {{GATEWAY_BASE_URL}}/v1/chat/completions` |
| 说明 | OpenAI 兼容；字段以网关透传上游为准 |
| 必填 | `model`、`messages` |
| 常用 | `stream`、`temperature`、`max_tokens`、`tools` |

#### 流式 `/api/streaming`

- SSE；结束标记与 OpenAI 一致（`data: [DONE]`）。  
- 给一段 `stream: true` 的 curl。

#### 思考参数 `/api/thinking`

- 说明 DeepSeek `thinking` / `reasoning_effort` 等经网关**透传**（写法对齐官方）；非 DeepSeek 模型忽略或报错策略在实现时定，文档写「仅对支持该参数的模型生效」。

#### 接入案例

| 页 | 要点 |
|----|------|
| OpenAI SDK | 只改 `baseURL` + `apiKey` + `model` |
| Agent / 编程工具 | 在兼容 OpenAI 的工具里把 Provider Base URL 换成 `{{GATEWAY_BASE_URL}}/v1`，填网关 Key，选上表模型 |
| 错误码 | 401 密钥；404 模型名；429 限流；502 上游；与控制台错误文案一致 |

#### 更新日志 `/changelog`

- 按日期记录：模型上下架、破坏性变更、文档 URL 变更。

### 1.6.5 与控制台联动

| UI 位置 | 行为 |
|---------|------|
| 顶栏「文档」 | `window.open('{{DOCS_BASE_URL}}')` |
| 登录「查看文档」 | 同上 |
| `/models` 行操作 | 「文档」→ `{{DOCS_BASE_URL}}/models/deepseek` 或 `/models/mimo#...` |
| 调试台「查看代码」 | 生成的 snippet 使用 `{{GATEWAY_BASE_URL}}/v1` 与当前模型 ID |

### 1.6.6 文档验收

1. 任意示例是否都出现 **本网关** base_url，而非直接写 api.deepseek.com / mimo 官网？  
2. 模型 ID 是否与 §1.6.2 一致？  
3. 占位符是否尚未误写成假域名冒充已上线？  
4. 控制台「文档」是否指向 `{{DOCS_BASE_URL}}`？


## 2. 信息架构与壳层

### 2.1 路由

| 路由 | 名称 | 登录要求 | 壳层 |
|------|------|----------|------|
| `/` | **进入页**（登录震撼页，见 6.0） | 否 | **无侧栏**；全视口宣言构图 |
| `/login` | （兼容）与 `/` **同构**或重定向至 `/` | 否 | 同 `/` |
| `/playground` | **模型调试工作台**（对标 Kimi 开放平台 Playground） | 是（首期可本地 master key 态） | 控制台壳 + **右侧参数栏** + 主调试区 |
| `/models` | 模型管理 | 是 | 控制台壳 |
| `/keys` | API Keys | 是（P2） | 控制台壳 |
| `/dashboard` | **数据看板**（原用量升级） | 是（P2） | 控制台壳 |
| `/usage` | （兼容）重定向 → `/dashboard` | — | — |

**路由策略（已锁定）：** 未登录访问受保护路由 → 重定向 `/`（或 `/login`，二者同构）。**不再维护第二套营销落地页**，避免样式漂移；§6.1 仅作历史说明，实现以 §6.0 为准。

### 2.2 登录前 vs 登录后

```text
未登录 / 或 /login（震撼介绍+登录）     登录后任意工具页
┌──────────────────────────────────┐   ┌──────┬──────────────────┐
│ 全视口电影级背景 + 巨型宣言文案    │   │ Logo │ 顶栏 52px         │
│ 右侧/下方：精密登录面板            │   ├──────┼──────────────────┤
│ （无工具侧栏、无定价卡墙）          │   │ 侧栏 │ 主内容            │
└──────────────────────────────────┘   │64/240│ max 1200 居中     │
                                       └──────┴──────────────────┘
```

**硬性规则：**

- `/`、`/login` **不得**出现 64px 工具侧栏。
- 登录成功默认进入 `/playground`。
- 登录页追求 **Hermes 体量 + Moonshot 宣言质感**（见 6.0），登录成功后立刻切回「精密仪器」克制控制台——震撼与诗意只存在于进入瞬间。

### 2.3 控制台壳层尺寸

| 区域 | 规格 |
|------|------|
| 顶栏高度 | 52px |
| 侧栏收起 | 64px |
| 侧栏展开 | 240px（悬停展开或钉住） |
| 主内容水平 padding | **App 密度 20–24px**（见 §5.1）；进入页用 Marketing 密度 |
| 主内容最大宽度 | 1200px，水平居中（Playground 工作台除外，吃满剩余宽） |
| 侧栏分割 | 右侧 1px `border-subtle`，背景与 `bg-base` 同色 |
| 顶栏 Logo | 见 §3.6 图形锚点，24–28px 单色标 + 文案 AI Gateway |

### 2.4 主导航项（登录后侧栏）

顺序固定：

1. Playground（调试台）
2. Dashboard（看板）
3. Models（模型）
4. Keys（密钥）

说明：原「用量 /usage」已并入看板；实现时将 `/usage` 重定向至 `/dashboard`。

底部：产品版本号（如 `v0.1.0`），`text-tertiary`，13px。

选中态：**左侧 2px 色条**（`accent-primary`，opacity 约 0.6，融入而非跳出）+ 图标 opacity 1；未选中图标 opacity 0.5。  
**禁止**整行高饱和背景色块作为选中态。

---

## 3. 设计令牌（Design Tokens）

实现时全部进入 CSS 变量（Tailwind v4 `@theme` 或 `:root`），组件禁止魔法色值散落。  
**主题：仅深色 v1**——不做半套 light mode，避免两套皮肤漂移。

### 3.1 基础色（深色基底）

```css
:root {
  /* 表面 · 海拔 0→2 */
  --bg-base: #0A0A0F;       /* 海拔 0：主背景，近黑微蓝 */
  --bg-elevated: #12121A;   /* 海拔 1：列表行、次级面板、KPI 卡 */
  --bg-surface: #1A1A24;    /* 海拔 2：输入框、代码块、弹出层 */
  --bg-hover: #22222E;      /* 悬停 */

  /* 边框：极克制 */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-active: rgba(255, 255, 255, 0.12);
  --border-focus: rgba(61, 139, 156, 0.50); /* 跟随钢青主色，非大面积 glow */

  /* 文字 */
  --text-primary: #E8E8EC;
  --text-secondary: #8B8B9E;
  --text-tertiary: #555566;
  --text-inverse: #0A0A0F;
}
```

### 3.2 强调色、状态色、图表色

```css
:root {
  /* Geek 产品主色：钢青 —— 区别于通用 SaaS 冰蓝与上游品牌色 */
  --accent-primary: #3D8B9C;
  --accent-primary-hover: #4FA3B5; /* 仅提亮，不做光晕扩散 */
  --accent-muted: rgba(61, 139, 156, 0.14);

  /* 状态：略降饱和，贴仪器灰阶 */
  --status-success: #3FA86A;
  --status-warning: #D4A017;
  --status-error: #E04B42;

  /* 上游品牌点缀：仅 6px 圆点 / 按模型分色折线，禁止大面积填充、禁止当主按钮色 */
  --brand-deepseek: #4D6BFE;
  --brand-mimo: #FF6B35;

  /* 图表中性色（缓存命中等非厂商语义） */
  --chart-cache: #8B8B9E;
  --chart-cache-hit: #5A9E7A;
  --chart-grid: rgba(255, 255, 255, 0.06);
  --chart-axis: #555566;
}
```

**硬性：** `--accent-primary`（Geek）≠ `--brand-deepseek` / `--brand-mimo`。侧栏选中条、主按钮、链接用钢青；模型圆点才用品牌色。

### 3.3 Glow 政策（硬性）

| 允许 | 禁止 |
|------|------|
| 焦点环 `0 0 0 2px var(--border-focus)` | 按钮 hover「光晕向外扩散」 |
| 卡片可选 `border-top: 1px solid rgba(255,255,255,0.08)` | 背景大面积径向光当主视觉 |
| 品牌圆点可极弱（≤ 8% opacity）外晕 1px | 导航/卡片整块外发光 |

`--accent-glow` **不作为正式令牌**。

### 3.4 表面质感

- **进入页**可叠噪点 2%–3% + 极弱同色系明暗（峰值 ≤ 8%）。  
- **控制台 / 调试台 / 看板**：默认**不叠噪点**（或 ≤ 1%），保持仪器面板干净，与进入页气质切断。  
- 进入页明暗**不得替代**任何产品实景需求；控制台以信息密度为准。

### 3.5 细节令牌（高级感低成本）

```css
:root {
  --overlay-scrim: rgba(0, 0, 0, 0.55); /* Dialog 遮罩；禁止重毛玻璃炫技 */
  --selection-bg: var(--accent-muted);
  --scrollbar-size: 8px;
  --scrollbar-thumb: rgba(255, 255, 255, 0.12);
  --z-dropdown: 40;
  --z-modal: 50;
  --z-toast: 60;
}
```

- 滚动条：细、低对比，与 `border-subtle` 同级存在感。  
- 文本选中：使用 `--selection-bg`。  
- Toast / Modal / Dropdown 严格按 z-index 三级，禁止随意 `z-[9999]`。

### 3.6 Logo / 图形锚点

| 规则 | 说明 |
|------|------|
| 形态 | 极简几何单色标（线框或实心几何），线宽视觉接近 Lucide |
| 尺寸 | 顶栏 24–28px；登录页可 40px |
| 颜色 | 默认 `text-primary` 或 `accent-primary` 单色；**禁止**渐变、多色、插画 |
| 搭配 | 标 + 文案「AI Gateway」；副标「Geek」用 Small / tertiary |
| 禁止 | 复杂吉祥物、3D、发光描边图标 |

未定稿前可用临时 SVG 几何（如旋转 45° 的圆角方 + 缺口）占位，上线前冻结一版。

---
## 4. 字体与字阶

### 4.1 字体家族

| 用途 | 字体 | 备注 |
|------|------|------|
| 展示 / 品牌名 / Display | Instrument Sans | 几何、克制、有辨识度 |
| 界面正文 / 导航 | Geist Sans | 与 Next 生态一致 |
| 代码 / Key / Token | IBM Plex Mono | Playground 输出、表格 Key |
| 中文回退 | Noto Sans SC / 思源黑体（**子集化**） | **不要**用微软雅黑；全量 Noto 过重，生产必须 subset |

加载示例（实现参考）：

- `next/font` 加载 Geist + Instrument + IBM Plex Mono  
- 中文用子集化 `Noto_Sans_SC` 或系统链末端回退

### 4.2 字阶

| Token | 尺寸 / 字重 | 用途 |
|-------|-------------|------|
| Display XL | 64–80px / 600（大屏可用 clamp） | **仅** `/login` 巨型宣言（Hermes 体量 × Moonshot 刊头感） |
| Display | 48px / 600 | 落地页品牌名；中屏登录回退 |
| H1 | 32px / 600 | 页面标题 |
| H2 | 24px / 500 | 区块标题 |
| Body | 15px / 400 | 正文（优先 15px，不用 14px 挤） |
| Small | 13px / 400 | 辅助、表格头、时间 |
| Mono | 14px / 400 | 代码与 Key |

登录页 Display XL 推荐：`clamp(40px, 6vw, 80px)`，字间距略收（约 `-0.02em`），行高 1.05–1.15，制造「基础设施级」压迫感与清晰度。

行高建议：正文 1.6；标题 1.25；Mono 1.5。

数字统计（看板 KPI）：`font-variant-numeric: tabular-nums`。

---

## 5. 间距、圆角、阴影、栅格

### 5.1 双密度刻度（已锁定）

基础刻度：`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`

| 密度档 | 用途 | 内容区水平 padding | 区块间距 | 表单字段间距 |
|--------|------|-------------------|----------|--------------|
| **Marketing** | `/` 进入页 | ≥ 48px（大屏） | ≥ 24–32 | — |
| **App** | 控制台、调试台、看板、密钥、模型 | **20–24px** | **16–24** | **12–16** |

硬性：进入页禁止套用 App 紧凑间距；调试台/看板禁止套用 Marketing 大留白（否则工具感变弱、信息疏）。

### 5.2 圆角

| 元素 | 圆角 |
|------|------|
| 主/次按钮 | 8px |
| 输入框、Select | 12px |
| 列表行、面板、KPI 卡 | 8px |
| 发送按钮（调试台） | 8px 矩形（非圆形） |
| **默认禁止** | 到处 `rounded-full` 药丸标签 |

### 5.3 阴影

- **默认无阴影**；层次靠海拔色与 1px 边框。  
- 弹出层允许：`0 8px 24px rgba(0,0,0,0.35)`；禁止多层彩色阴影。

### 5.4 栅格

- 控制台主列最大 **1200px**（Models / Keys / Dashboard）。  
- Playground：壳层内吃满剩余宽；右参数栏约 **300px**。  
- 文档站正栏见 §1.6.3 视觉（720–760px），与控制台脱钩。

---
## 6. 页面布局蓝图

### 6.0 登录页 /login（Hermes 体量 × Moonshot 宣言）

双参考：

1. [Nous Portal](https://portal.nousresearch.com/manage-subscription) —— 全幅暗场、进入基础设施的**体量与仪式**。  
2. [Moonshot AI](https://www.moonshot.ai/) —— 如 *Seeking the optimal conversion from energy to intelligence* 一类的**一句哲学宣言**、极大留白、编辑/研究机构气质，而非 SaaS 仪表盘开场。

**合成口诀：骨架学 Hermes（左右分栏、闸门感），文气学 Moonshot（一句说透、留白说话）。**  
不要复制 Nous 的订阅价目墙，也不要复制 Moonshot 首页的 doodle/节日插画墙。

#### 6.0.1 情绪目标

进入页应让人在 1 秒内感到：

> 这不是普通后台登录框，而是通往统一模型调度基础设施的闸门——且这句话本身值得被记住。

| 来源 | 感知 | 本产品转译 |
|------|------|------------|
| Hermes / Nous | 巨型产品宣言、电影级暗场、规模感 | Display XL、全视口、左宣言/右登录 |
| Moonshot | 一句近乎使命的哲思句；呼吸感；少即是多 | 宣言打磨到可独立成刊头；标题周围大量负空间；副文不超过 2 行 |
| Hermes | 「进入账户」克制 | 右侧精密登录面板，像仪器舱门 |
| Moonshot | 不靠光效与贴纸证明高级 | 禁止彩光球、粒子、徽章；高级感来自字距、对齐、留白 |

#### 6.0.2 桌面布局（已锁定：左宣言 / 右登录）

`	ext
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]                                              [文档]      │  顶栏透明/极淡，高 52–64
├────────────────────────────────┬────────────────────────────────┤
│                                │                                │
│  （上方刻意留白，勿顶死）         │                                │
│                                │   ┌──────────────────────────┐ │
│  AI GATEWAY                    │   │  进入平台                 │ │
│  （Small / tertiary 或省略）    │   │                          │ │
│                                │   │  邮箱 / 账号              │ │
│  一个入口，                     │   │  密码 或 Master Key      │ │
│  调度所有大模型                 │   │                          │ │
│  （Display XL，可两行；字距略收） │   │  [ 进入 → ]              │ │
│                                │   │  次要链：文档             │ │
│  统一转发 DeepSeek 与 MiMo。    │   └──────────────────────────┘ │
│  （最多 2 行 secondary；行距松） │     面板：安静、不抢标题       │
│                                │                                │
│  （下方再留白）                  │                                │
│  DeepSeek V4 · MiMo V2.5         │                                │
│  （一行 Small tertiary）        │                                │
└────────────────────────────────┴────────────────────────────────┘
     ≈ 58–62% 宽 · 垂直光学居中        ≈ 38–42% 宽 · 垂直居中
     标题块上下负空间 ≥ 标题自身高度     面板宽度约 360–400px
`

**Moonshot 式留白硬性要求：**

- 左栏宣言块上下各保留明显空区，**禁止**把标题顶到贴近顶栏或贴满分割线。  
- 宣言与支撑句之间间距 ≥ 24px；支撑句与能力旁注之间 ≥ 32px。  
- 右栏面板周围也要喘气：不要贴屏幕右缘（建议右侧 inset ≥ 48–64px）。

窄屏（< 768）：宣言在上（缩小到 Display），登录面板在下全宽；仍禁止侧栏、价目卡、插画墙。

#### 6.0.3 视觉层级（硬性）

1. **第一主角：宣言标题**（Display XL）——视口内最大字；去掉它后不应仍像「通用登录模板」。  
2. **第二：登录面板**——安静、对齐、像精密部件。  
3. **第三：Logo + 一行能力旁注**——不抢标题。  
4. **禁止首屏：** 套餐价格卡、Token 统计、模型网格、浮动徽章、紫光球、粒子海、节日 doodle 轮播。

#### 6.0.4 背景与「震撼 / 高级」的合法手段

允许：

- 全视口 --bg-base
- 极弱噪点（2–3%）——偏胶片/纸感，贴近 Moonshot 的「印刷」气质，而非电竞灯效
- 自左下→右上或自中心的**低对比**明暗渐变（同色系灰蓝，峰值透明度 ≤ 8%）
- 左/右分栏之间 1px order-subtle 或仅靠留白分区（更 Moonshot：可弱化实体分割线）
- 可选：左半区底部淡入 **Playground 压暗实景**（低对比），不挡标题

禁止：

- 大面积 accent 光晕、彩色光束、鼠标跟随光斑  
- 3D 飞船、抽象粒子作主视觉  
- Nous 式多列定价卡、Moonshot 式 doodle 网格当登录装饰  

#### 6.0.5 登录面板细节

| 元素 | 规范 |
|------|------|
| 面板标题 | H2 或 18–20px / 500：「进入平台」 |
| 字段 | 见 7.2；首期可支持「Gateway Master Key」单字段快捷进入 |
| 主按钮 | Primary 全宽：「进入」；hover 仅提亮 |
| 错误 | 面板内 status-error 一行字，不弹模态 |
| 气质 | 表单本身「无聊一点」——戏给左边宣言，不给输入框描金边 |

#### 6.0.6 进入动效（登录页可多 1 处，仍克制）

在全局三处主推动效之外，**仅登录页允许**：

| 序列 | 动效 | 参数 |
|------|------|------|
| 1 | 宣言：opacity 0→1，y 12→0（位移略小于纯 Hermes，更沉稳） | 400–500ms，ease-out，载入一次 |
| 2 | 面板：延迟 100–150ms 后淡入 | 350ms，ease-out |
| 3 | 背景明暗：可选 600ms 内定稿 | 无循环 |

登录成功：短促淡出（150ms）→ /playground；不要彩带或全屏光爆。

#### 6.0.7 文案

**完整登录文案以 §1.5.4 为准。** 此处只强调层级：

1. Display XL：**一个入口，调度所有大模型**（产品宣言）  
2. 支撑句 ≤ 2 行（事实）  
3. 签名区更小：**Geek · 高科极客工作室** + **有趣的人，做有趣的事**（工作室口号）  
4. 右栏：**进入 AI Gateway** / 按钮「进入」

**句质验收：** 产品主标题单独截图仍像基础设施宣言；工作室口号不抢主标题字号。

---

### 6.1 落地页（已废弃独立实现）

**v1.7 锁定：** `/` = §6.0 进入页；不再单独做营销落地。以下仅归档，**不要实现第二套 Hero**：

**首屏预算（硬性）：** 品牌（Logo + 名称）+ 一句 headline + 一句支撑文案 + 一组 CTA + **一个**产品实景锚点。  
**禁止出现在首屏：** 模型卡片、请求量、Token、费用、徽章贴纸、订阅价目墙。

```text
┌──────────────────────────────────────────────────────────┐
│  [Logo]  AI Gateway              [文档]  [登录/进入]      │  ← 可选极简顶栏
├──────────────────────────────────────────────────────────┤
│                                                          │
│   AI Gateway                                             │  Display
│   一个入口，调度所有大模型                                 │  H2 / secondary
│                                                          │
│   [ 进入平台 → ]   [ 查看文档 ]                            │  主 CTA → /login
│                                                          │
│   ┌────────────────────────────────────────────────────┐ │
│   │  Playground 静态实景（消息流 + 输入框示意）          │ │  ← 真实产品锚点
│   │  可右侧或下方全宽；边缘到内容区，不要小卡片缩略乱贴   │ │
│   └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**实景锚点要求：**

- 展示可辨认的对话界面（用户句 + 助手句 + 底部输入），可脱敏静态。
- 可用轻微遮罩渐隐底部，暗示「进入后继续」。
- **不要**用抽象粒子 / 大面积径向光代替该锚点。

**次屏（可选，滚过首屏后）：** 用简单文字列表说明「已接入 DeepSeek / MiMo」，**仍避免卡片网格**；或直接链到登录后的 `/models`。

### 6.2 Playground `/playground`（对标 Kimi 开放平台调试台）

**权威参考：** [https://platform.kimi.com/playground](https://platform.kimi.com/playground)  
（文档亦称「Playground 开发工作台」——调模型、调参数、看 Token、看调用代码；**不是** [kimi.com](https://www.kimi.com) 面向消费者的聊天页。）

#### 6.2.1 产品定位

| 是 | 不是 |
|----|------|
| API / 网关调试台 | C 端陪伴式聊天 |
| 可改 System Prompt、温度、模型 | 只有一个大输入框 |
| 可见 Token 消耗、可「查看代码」 | 隐藏一切开发者信息 |
| 消息按 **role**（system / user / assistant）清晰标注 | 圆角左右气泡对聊 |

#### 6.2.2 桌面布局（已锁定）

```text
┌──────┬────────────────────────────────────┬──────────────────┐
│ App  │  [System Prompt 可折叠编辑区]        │  参数面板 ~300px  │
│ 主导 │────────────────────────────────────│                  │
│ 航   │  工具条：清空 · 查看代码 · 导出/导入  │  模型 ▾           │
│      │      （P2：对比模型 / Tools）         │  DeepSeek·MiMo点  │
│      │────────────────────────────────────│                  │
│      │                                    │  Temperature ——● │
│      │   消息调试流（按 role 分行）         │  Max tokens      │
│      │   USER / ASSISTANT 标签 Small       │  Top P（可选）    │
│      │   无传统气泡；代码块 Mono+Shiki      │  Stream 开关      │
│      │   流式 ▌                            │                  │
│      │   （P2：Tool call 折叠块）           │  [应用到请求]     │
│      │                                    │                  │
│      │────────────────────────────────────│──────────────────│
│      │  [ 输入下一条 user 消息… ]  [发送]   │                  │
│      │  Tokens  in · out · total（Small）  │                  │
└──────┴────────────────────────────────────┴──────────────────┘
```

- **左侧**：全局 App 导航（Playground / Dashboard / Models / Keys），64/240。  
- **中列**：调试主舞台（System Prompt → 消息流 → 输入 → Token 条）。  
- **右列**：参数面板（对标 Kimi Playground「模型配置」），`--bg-elevated`，左缘 1px `border-subtle`。  
- **不再**把「对话历史 280px」当作第一侧栏；会话列表可收进顶栏菜单或导航「历史」抽屉（P1 可单会话，P2 再补多会话）。

#### 6.2.3 各区块规范

**System Prompt 区**

- 默认折叠为一行摘要：「System Prompt · 点击编辑」；展开为 Textarea（`--bg-surface`）。  
- 支持作为请求的 `system` 角色；与消息流分离存放。  
- 字号 Body；Mono 非必须。

**参数面板（右）**

| 控件 | 说明 |
|------|------|
| 模型 Select | 网关别名；项前 6px 品牌色圆点（DeepSeek / MiMo） |
| Temperature | Slider + 数值 |
| Max tokens | Number input |
| Stream | Switch，默认开 |
| 其余 | 按上游能力增量；勿一次堆满 |

面板标题：「模型配置」或「Parameters」，Small / tertiary。  
改变参数后不必弹窗；下一次发送携带当前值即可。

**消息调试流**

- 每条消息左侧或上方 **role 标签**：`SYSTEM` / `USER` / `ASSISTANT`（Small、等宽感、`text-tertiary`）。  
- **禁止**微信式左右彩色气泡。  
- Assistant：Markdown + 代码块（见 7.7）；流式末尾 `▌`。  
- P2：Tool call 以折叠块展示（名称、参数 JSON、结果），视觉贴近「调试」而非「聊天」。

**工具条**

- Ghost 按钮：清空会话、查看代码、（P2）导出/导入 JSON、多模型对比。  
- 「查看代码」：打开 Dialog / 侧抽屉，展示当前请求的 OpenAI 兼容 `curl` 或 JS SDK 片段（指向本网关 `baseURL`），一键复制。

**底栏**

- 输入区：圆角 12、`Enter` 发送 / `Shift+Enter` 换行；发送为圆角 8 矩形按钮（调试台感），**不必**强制圆形。  
- Token 条：本次或累计 `prompt / completion / total`，`IBM Plex Mono` + `tabular-nums`，`text-tertiary`；对齐 Kimi Playground 底部统计信息。

#### 6.2.4 与参考站的取舍

| 从 platform.kimi.com/playground 学习 | 本产品首期可简化 |
|--------------------------------------|------------------|
| System Prompt + 参数侧栏 + 消息流 + Token | 官方 Tools / MCP 全量 |
| 查看代码 / 复制调用示例 | 三模型同屏对比（放 P2） |
| 角色化调试体验 | Showcase 案例按钮（可选 P3） |
| 干净的开放平台控制台视觉 | 照搬 Kimi 品牌色与 Logo |

#### 6.2.5 视觉语气

- 仍用本规范色板与字体（精密仪器），**不要**换成 Kimi 品牌色去「山寨皮肤」。  
- 密度略高于登录页：允许更多分割线与表单控件，但仍禁止重阴影与 glow。  
- 中列左右 padding 使用 **App 密度 20–24px**（§5.1），右栏内边距 16；进入页的 Marketing 留白不得搬进调试台。

### 6.3 模型列表 `/models`

```text
┌─ 模型管理 ─────────────────────────────────────────┐
│  已接入 N 个模型 · 状态摘要（一句 secondary）         │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ ● deepseek-v4-pro        DeepSeek             │ │
│  │   文本旗舰 · …             状态：正常           │ │
│  │              [试用] [文档] [详情] ← hover 显    │ │
│  └───────────────────────────────────────────────┘ │
│  … MiMo-V2.5-Pro …                                  │
└─────────────────────────────────────────────────────┘
```

- 行容器：`--bg-elevated` + 1px `--border-subtle`；hover 边框到 `--border-active`。
- 左圆点 6px，品牌色；**不要**整卡品牌渐变底。
- 操作默认隐藏，行 hover 显现（触控设备可常显）。
- 「文档」链到 `{{DOCS_BASE_URL}}/models/...`（见 §1.6.5）；模型 ID 全集见 §1.6.2。

### 6.4 API Keys `/keys`（P2）

- **表格式**，不要重卡片包裹每一行。
- 表头：Small + `text-tertiary`。
- 行分割：`border-subtle`。
- Key：默认 `sk-****…xxxx`；眼睛图标切换明文；复制按钮行 hover 出现，成功后 2s 内显示勾。
- 右上角主按钮「创建」。

### 6.5 数据看板 `/dashboard`（P2；原 `/usage` 升级）

**路由：** `/dashboard`。兼容：`/usage` → 重定向 `/dashboard`。  
**定位：** 网关运维总览（请求、Token、费用、错误、**缓存命中**），不是营销统计墙。

#### 6.5.1 桌面布局

```text
标题「看板」+ 副标题 + 时间范围（24h / 7d / 30d）
────────────────────────────────────
KPI 行（纯数字卡，禁止装饰图标墙；可两行排布）：
  总请求 | 总 Token | 预估费用 | 错误率 | 缓存命中率 | 可选：P95 延迟
────────────────────────────────────
主图：调用量 / Token 趋势（按模型分色折线）
次图或并排：
  - 费用占比 / 模型分布（柱/折优先，克制）
  - 缓存命中 vs 未命中趋势（双线或堆叠面积；P3）
────────────────────────────────────
下区表格（上下叠或 Tab）：
  - 近期失败请求（时间、模型、状态码、摘要）
  - Top 密钥调用（名称、请求数、Token）— 依赖 Virtual Keys 时显示
```

最大内容宽 1200px；KPI 卡：`--bg-elevated` + 1px `border-subtle`；数字用 Instrument/Geist + `tabular-nums`。

#### 6.5.2 硬性规则

- KPI：**数字 + 环比变化率**（Small）；无渐变底、无大图标装饰。  
- 时间范围切换：内容淡入即可，禁止整页骨架闪烁。  
- **缓存未启用**：命中率 KPI 显示文案「未启用」，**禁止**显示误导性的 `0%`。  
- DeepSeek / MiMo 仅用于「按模型」折线分色与圆点，不大面积铺品牌色。
- **缓存命中**系列使用 `--chart-cache` / `--chart-cache-hit`，禁止用 MiMo 橙或 DeepSeek 蓝表示缓存。

#### 6.5.3 数据口径（对接 LiteLLM）

| 指标 | 口径 |
|------|------|
| 总请求 / Token / 预估费用 | 网关 spend logs（P2 配置 Postgres 后） |
| 错误率 | （5xx + 上游失败）/ 总请求 |
| **缓存命中率** | `cache_hit / (cache_hit + cache_miss)`（仅计启用缓存的请求）；旁注可显示命中次数。来自 LiteLLM 缓存回调/日志（需配置 `cache` + Redis 等） |
| P95 延迟 | 有延迟埋点则显示；否则隐藏该 KPI，不留假数据 |

实现备注：网关开启 LiteLLM cache 后命中率才有真数；本文只定产品表现，不展开 Redis 配置教程。

#### 6.5.4 空态

- 标题：还没有数据  
- 说明：去调试台跑几轮，或等流量进来后再看。  
- 次要按钮：打开调试台  


---

## 7. 组件规范

### 7.1 按钮

| 类型 | 样式 | 用途 |
|------|------|------|
| Primary | `accent-primary` 实心，字 `text-inverse`，圆角 8px | 主 CTA、创建、发送（圆形变体除外） |
| Secondary | 透明底 + `border-subtle`，字 `text-primary` | 次要（查看文档等） |
| Ghost | 无边框，hover `bg-hover` | 工具栏、表行操作 |
| Destructive | 字/边 `status-error`，慎用实心红 | 吊销 Key、删除会话 |

Hover：Primary 用 `--accent-primary-hover` **提亮**，禁止光晕扩散。  
Disabled：opacity 0.4，`pointer-events: none`。

### 7.2 输入 / Textarea

- 背景 `--bg-surface`；边框 `--border-subtle`；圆角 12px；正文 15px。
- Focus：边框 `--border-active` + 2px focus ring（`--border-focus`）。
- Placeholder：`text-tertiary`。

### 7.3 Select / 下拉（Radix Dropdown）

- 触发器与输入同高视觉重量。
- 菜单：`--bg-surface`，1px 边框，轻阴影。
- 项 hover：`--bg-hover`；选中项左侧可微标，或 check 图标。
- 模型项：名称 + 6px 品牌圆点。

### 7.4 Slider（温度等）

- 轨道细、矮；强调色仅填充已选区间。
- 拖动时旁注当前数值（Small）；默认不占一整行过宽宽度。

### 7.5 导航项

- 图标 24px Lucide；收起态仅图标；展开态图标+标签。
- 选中：左 2px 条 + 满 opacity；禁止整行高亮块。

### 7.6 表格

- 无斑马纹或极淡 hover 即可。
- 表头不加重底，靠字色层级。
- 单元格垂直 padding 12–14px。

### 7.7 代码块（Playground）

- 背景 `--bg-surface`；圆角 8px；左右 16px padding。
- 左上：语言标签 Small / tertiary。
- 右上：复制按钮，默认淡出，hover 块时显现。
- Shiki 暗色主题；行号可选，默认关闭以减噪。

### 7.8 空态 / 错误 / 加载

| 状态 | 表现 |
|------|------|
| 空对话 | 一句 secondary 提示 + 建议示例提问（文字链，非三列大卡） |
| 空 Key 列表 | 一文案 +「创建」主按钮 |
| 错误 | 行内或顶栏轻提示，`status-error` 文字；可重试 |
| 加载 | 优先内容区淡入；**禁止**刺眼骨架闪烁作为品牌动效 |

### 7.9 可选「微光顶线」

面板顶部：

```css
border-top: 1px solid rgba(255, 255, 255, 0.08);
```

仅用于 elevated 面板，不叠加彩色 glow。

---

## 8. 动效规范

### 8.1 主推三处（控制台内必须有）

| # | 位置 | 动效 | 参数 |
|---|------|------|------|
| 1 | 路由 / 主内容切换 | opacity 0→1，y 8→0 | 150ms，ease-out |
| 2 | Playground 流式输出 | 文本增量；光标闪烁 | 光标周期约 500ms |
| 3 | Primary 按钮 hover | 背景色提亮 | 200ms，ease-out |

侧栏宽 64↔240：宽度过渡 200ms ease-out，**禁止弹跳 spring**。

### 8.1.1 登录页例外（见 6.0.6）

允许一次载入的宣言/面板 staggered 淡入（最长约 500ms）。**禁止**把该时长套用到控制台内页。

### 8.2 禁止

- 消息「弹入」scale / bounce  
- 页面进入时强烈骨架闪烁  
- 背景粒子、鼠标跟随光斑、彩色光爆登录成功  
- 循环呼吸发光边框  
- 控制台内超过 300ms 的装饰性位移  
- 登录页用定价卡翻转入场冒充「震撼」

---

## 9. 响应式

| 断点 | 行为 |
|------|------|
| ≥ 1200 | 登录页左宣言/右面板；控制台标准壳层；历史侧栏 280 可开 |
| 768–1199 | 登录页比例可改为 55/45；主侧栏默认收起 64；历史侧栏可抽屉化 |
| < 768 | 登录页改上下结构（宣言→面板）；主导航底部 Tab 或汉堡；Playground 历史进抽屉 |

桌面优先设计与实现；移动端保证可对话、可看模型列表即可，不追求与桌面同等信息密度。

---

## 10. 无障碍与键盘

- 正文与 `bg-base` 对比度目标 ≥ 4.5:1（`text-primary` 已满足；`tertiary` 仅用于非必要信息）。
- 所有可交互元素可见 **focus ring**（键盘导航时）。
- Playground：Enter 发送，Shift+Enter 换行；Esc 可关闭下拉/抽屉。
- 图标按钮必须有 `aria-label`（发送、复制、新建等）。
- 动效遵循 `prefers-reduced-motion`：减弱时关闭位移，仅保留必要显示。

---

## 11. Do / Don't

| Do | Don't |
|----|-------|
| 登录页：巨型一句宣言 + 精密登录面板（Hermes 体量 × Moonshot 留白） | 登录页堆订阅价目卡、模型网格、彩光球、doodle 墙 |
| `/playground` 做成开放平台调试台（对标 platform.kimi.com/playground） | 做成 C 端聊天 App（无参数栏/无 System Prompt/无 Token） |
| `/` 或 `/login` 无工具侧栏 | 把控制台壳套在进入页上 |
| 震撼只存在于进入瞬间；进控制台立刻克制 | 全站维持「史诗光效」 |
| 落地/进入首屏：品牌宣言优先 | Hero 放统计、徽章、Token 数字 |
| 强调色约 5% 面积 | 大面积 accent 底、彩色 glow |
| 消息按 role 标注、无传统气泡 | 左右彩色圆角气泡墙 |
| 品牌色只用于 6px 点与图表 | 整卡品牌渐变 |
| 列表/表格保持扁平 | 无交互意义的厚卡片阴影 |
| 控制台动效 150–200ms ease-out | 弹跳、粒子、成功光爆 |
| Key 遮挡 + hover 操作 | 默认明文铺满、操常驻抢视线 |
| 使用令牌变量（钢青主色） | 组件内写死旧冰蓝 `#4A9EFF` 或上游品牌色当主按钮 |
| App / Marketing 双密度分用 | 调试台套大留白、进入页套表单紧凑间距 |
| 缓存图用中性 chart 色 | 用 DeepSeek/MiMo 色表示缓存命中 |
| 仅深色 v1 | 半套未完成的 light theme |

---

## 12. 实现对照清单

### 12.1 工程落地顺序（前端视觉）

1. 建立 `:root` / `@theme` 令牌（第 3 章全文）。  
2. `next/font` 接入三字体 + 中文回退；登录页使用 Display XL（`clamp`）。  
3. 布局组件：`AuthShell` / `MarketingShell`（无侧栏全视口）与 `AppShell`（顶栏+侧栏）。  
4. **优先实现 `/login`（第 6.0 节：Hermes 体量 × Moonshot 宣言）**；首期可将 `/` 重定向或同构到该页。  
5. Playground 按第 6.2 节（对标 platform.kimi.com/playground：System Prompt + 右参数栏 + Token + 查看代码）；Radix 用于 Select / Dialog / Switch；Motion 按第 8 章。  
6. Models 列表页。  
7. P2：Keys 表、Dashboard 看板（含缓存命中率）。  

### 12.2 Tailwind / CSS

- 颜色一律 `bg-[var(--bg-base)]` 或 theme 映射名（如 `bg-base`）。  
- 禁止未登记的任意紫色渐变工具类组合。  
- 登录页背景明暗仅用同色系低透明度；主色用钢青；不引入「史诗紫」或旧冰蓝 `#4A9EFF` 令牌。  

### 12.3 Radix 原语建议

| 场景 | 原语 |
|------|------|
| 模型选择、菜单 | DropdownMenu / Select |
| 创建 Key、确认吊销 | Dialog |
| 温度 | Slider |
| 侧栏移动端 | Dialog 或 Sheet 模式 |
| Tooltip | Tooltip（图标按钮） |
| 登录表单 | 原生 form + 可访问标签即可；无需 Dialog |

皮肤：自行覆盖颜色与圆角，**不要**直接粘贴一套默认 shadcn 主题色。

### 12.4 Motion 参数备忘

```ts
// 控制台路由内容
{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.15, ease: "easeOut" } }

// 登录页宣言（仅 /login）
{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: "easeOut" } }

// 登录面板（delay 约 0.1s）
{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: "easeOut", delay: 0.1 } }

// 按钮色变由 CSS transition 200ms 即可，不必上 JS spring
```

### 12.5 内容文案

**以 §1.5 品牌与全站文案体系为唯一文案源。** 实现时不要在组件里另写一套。

速查：

| 位置 | 文案 |
|------|------|
| 工作室 | 高科极客工作室 / Geek |
| 口号 | 有趣的人，做有趣的事 |
| 产品 | AI Gateway |
| 登录宣言 | 一个入口，调度所有大模型 |
| 登录按钮 | 进入 |

---

## 13. 与开发分期的视觉范围

### P1（必须达到本规范）

- [ ] 令牌与字体就绪（含 Display XL、**钢青主色**、双密度、Logo 锚点）
- [ ] `/` 进入页与 `/login` 同构，无第二套营销 Hero  
- [ ] `/login`：左宣言/右面板；Display XL；Moonshot 级留白；无价目卡/无 doodle 墙/无工具侧栏  
- [ ] 未登录访问受保护路由重定向 `/login`；成功后进 `/playground`  
- [ ] `AppShell` + `/playground` 对标 [platform.kimi.com/playground](https://platform.kimi.com/playground)：System Prompt、右参数栏、role 消息流、底栏 Token、查看代码、无 C 端气泡  
- [ ] `/models` 列表行样式  
- [ ] 控制台三处主推动效 + 登录页载入序列  
- [ ] 焦点环与基本键盘发送
- [ ] 登录页与壳层文案按 §1.5 落地（含 Geek 签名与口号）  

### P2

- [ ] `/keys` 表格交互（遮挡、复制、创建）  
- [ ] `/dashboard` 数据看板：KPI（总请求、Token、费用、**缓存命中率**；未开缓存显示「未启用」）+ 调用趋势图 + 空态；`/usage` 重定向至此  
- [ ] 看板：近期失败列表、Top 密钥（有数据再显）  
- [ ] 正式账号密码 / SSO（若需要）替换纯 Master Key 登录  
- [ ] Playground：多模型对比、Tool call 可视化、导出/导入会话 JSON（对齐 Kimi Playground 进阶能力）
- [ ] 接入文档站按 §1.6 上线：替换 `{{DOCS_BASE_URL}}` / `{{GATEWAY_BASE_URL}}`；含快速开始、模型清单、API 与接入案例  

### P3

- [ ] 看板：P95 延迟、费用占比、**缓存命中趋势次图**、导出 CSV  
- [ ] 登录页可选 Playground 压暗实景层  
- [ ] 噪点纹理与微光顶线微调  
- [ ] 空态文案与错误态统一  
- [ ] `prefers-reduced-motion` 全面检查（登录长动效需降级为瞬显）  
- [ ] 窄屏抽屉与底部导航打磨  

---

## 14. 设计验收速查（提测用）

1. 打开 `/login`：3 米外能否先读到**一句宣言**，而不是先看到表单或价目卡？标题周围是否有明显留白（Moonshot）？  
2. 把主标题单独截出：是否仍像机构使命句，而非营销口号堆砌？  
3. 该页是否仍有「去掉导航也能认出品牌」的冲击力（Hermes 体量）？有无模型卡/统计/套餐墙/插画墙？  
4. 登录成功进入控制台后，是否立刻变为克制工具感（无残留史诗光效）？  
5. `/playground` 是否一眼能看出是**调试台**（有 System Prompt / 参数栏 / Token），而不是 C 端聊天？  
6. 主色是否为钢青 Geek 色（而非通用冰蓝/上游品牌色）？强调色是否只出现在按钮、链接、选中条、光标等少数位置？  
7. 消息是否按 role 标注且非气泡？  
8. 有无大面积发光、紫渐变、圆角药丸标签墙？  
9. 控制台路由切换是否短促淡入而非弹跳？  
10. Models 行 hover 是否才显示次要操作？  
11. DeepSeek / MiMo 色是否仅圆点/折线？
12. 打开 `/dashboard` 是否像运维总览而非营销统计墙？缓存关闭时是否显示「未启用」而非假 `0%`？
13. 缓存图是否使用中性 chart 色？控制台是否为 App 密度、进入页为 Marketing 密度？
14. 是否仅深色、且有单色 Logo 锚点？  

任一项失败 → 先改视觉再加功能。

---

## 15. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-07-24 | 基于「深空工具台」草案重构：弱化 glow、重做落地页预算、区分登录壳层、补齐令牌/组件/a11y/分期验收 |
| 1.1 | 2026-07-24 | 新增 §6.0 登录页：对齐 Nous/Hermes Portal 介绍冲击力（巨型宣言 + 精密闸门面板）；锁定左文右登录、禁止价目卡墙；补充 Display XL、登录动效例外与验收项 |
| 1.2 | 2026-07-24 | 双参考并入 [Moonshot AI](https://www.moonshot.ai/)：哲学级一句宣言、编辑级留白、印刷感噪点；明确不抄 doodle 墙；句质验收与留白硬性间距 |
| 1.3 | 2026-07-24 | **纠正 Kimi 参考**：主工作台对齐 [platform.kimi.com/playground](https://platform.kimi.com/playground) 开发调试台（System Prompt、参数侧栏、Token、查看代码）；明确不是 C 端聊天页；重写 §6.2 |
| 1.4 | 2026-07-24 | 新增 §1.5 品牌与全站文案：高科极客工作室 / Geek；口号定稿「有趣的人，做有趣的事」；补齐登录与各子页（调试台/模型/密钥/用量）文案表 |
| 1.5 | 2026-07-24 | `/usage` 升级为数据看板 `/dashboard`；KPI 含错误率与**缓存命中率**（未启用显示「未启用」）；补布局/口径/文案/P2·P3；导航改为 调试台·看板·模型·密钥 |
| 1.6 | 2026-07-24 | 新增 §1.6 接入文档设计：IA、占位符、DeepSeek V4 / MiMo V2.5 全量模型清单、首次调用三栏示例骨架；同步文档入口与 `/models` 示例名 |
| 1.7 | 2026-07-24 | **样式优化补丁**：主色改钢青 `#3D8B9C`（与上游品牌色分离）；Marketing/App 双密度；Logo 锚点；文档站 720–760 阅读栏；图表 `--chart-cache*`；滚动条/选中/遮罩/z-index；仅深色 v1；锁定 `/`=`/login` 同构进入页；状态色降饱和 |

---

*本文是前端视觉与交互的权威说明。实现冲突时，以本文 Do/Don't 与硬性规则为准；色值变更须先改令牌表再改组件。*
