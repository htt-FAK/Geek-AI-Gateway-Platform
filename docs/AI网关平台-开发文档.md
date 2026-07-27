# AI 网关平台开发文档

> 版本：1.0  
> 更新日期：2026-07-24  
> 用途：切换新工作目录后按本文档直接开工，不依赖历史聊天上下文。

---

## 1. 项目目标与范围

### 1.1 目标

自建一套 **AI 网关平台**：

- **后端**：用官方 LiteLLM Proxy 统一转发上游大模型请求（OpenAI 兼容协议）。
- **上游（首期）**：DeepSeek 官网 API + 小米 MiMo 官网 API。
- **前端**：自研管理台与 Playground，视觉偏高级、工具感；**不使用** LiteLLM 自带 Admin UI 作为产品界面。

### 1.2 首期范围（做）

| 能力 | 说明 |
|------|------|
| 统一网关 | 单一 `baseURL` 调用 DeepSeek / MiMo |
| 模型别名 | 对外暴露稳定 `model_name`，与上游真实模型解耦 |
| 网关鉴权 | `master_key`；后续 Virtual Keys |
| Playground | 选模型、流式对话 |
| 管理台骨架 | 模型列表、Key 管理入口、用量看板占位 |

### 1.3 首期不做

- 企业 SSO / OIDC 全套
- 完整多租户计费与发票
- 改 LiteLLM Python 源码 / fork 长期维护
- 用官方 `ui/` 当产品前端
- Terraform / K8s 大规模部署（首期 Docker Compose 即可）

---

## 2. 总体架构

```mermaid
flowchart LR
  subgraph clients [Clients]
    Web[Nextjs_Web]
    SDK[OpenAI_SDK_or_curl]
  end

  subgraph gateway [LiteLLM_Proxy]
    Auth[MasterKey_VirtualKeys]
    Router[Model_Router]
    Log[Spend_Logs]
  end

  subgraph upstream [Upstream_Official]
    DS[DeepSeek_api.deepseek.com]
    MiMo[MiMo_api.xiaomimimo.com]
  end

  Web --> Auth
  SDK --> Auth
  Auth --> Router
  Router --> DS
  Router --> MiMo
  Router --> Log
```

### 2.1 请求路径

1. 前端或业务方请求：`POST {GATEWAY}/v1/chat/completions`
2. Header：`Authorization: Bearer <master_key 或 virtual_key>`
3. Body 中的 `model` 为网关配置的别名（如 `deepseek-chat`、`mimo-v2.5-pro`）
4. LiteLLM 按 `config.yaml` 路由到 DeepSeek / MiMo，并回写 OpenAI 兼容响应（含 SSE 流式）

### 2.2 职责边界

| 层 | 做什么 | 不做什么 |
|----|--------|----------|
| LiteLLM Proxy | 转发、鉴权、限流、日志、计费钩子、负载与 fallback | 当最终产品 UI |
| 自研前端 `web/` | 品牌、Playground、Key/用量展示、交互与动效 | 直连 DeepSeek / MiMo |
| 业务配置 `gateway/` | `config.yaml`、环境变量、Compose | 拷贝整份 LiteLLM monorepo 进业务仓 |

### 2.3 已锁定版本与本机路径

| 项 | 值 |
|----|-----|
| LiteLLM 版本 | **`v1.83.14-stable`**（勿日常跟踪 `main`） |
| 本机源码参考克隆 | `D:\Users\taotao.huang\Desktop\tool\litellm` |
| 本机 Git HTTPS 代理 | `http://127.0.0.1:7890`（Clash for Windows） |

---

## 3. 技术栈清单

### 3.1 后端网关

| 组件 | 选型 |
|------|------|
| 网关 | LiteLLM Proxy（Docker 镜像运行） |
| 配置 | 自维护 `config.yaml` |
| 密钥 | 环境变量：`DEEPSEEK_API_KEY`、`MIMO_API_KEY`、`LITELLM_MASTER_KEY` |
| 可选持久化 | Postgres（Virtual Keys / 用量，P2 再开） |
| 可选缓存/多实例 | Redis（P2+） |

### 3.2 前端

| 层 | 选型 | 说明 |
|----|------|------|
| 框架 | **Next.js 15（App Router）+ TypeScript** | 管理台 + Playground 一体 |
| 样式 | **Tailwind CSS v4 + CSS 变量设计令牌** | 自有色板，避免模板脸 |
| 动效 | **Motion**（原 Framer Motion） | 2～3 处克制动效即可 |
| 组件底盘 | **Radix UI 原语 + 自研皮肤** | 可访问性好；不整站套默认 shadcn 主题 |
| 图标 | Lucide 或 Phosphor | 细线风格 |
| 字体 | Geist / Satoshi / Instrument Sans + IBM Plex Mono | **禁止** Inter / Roboto / 系统默认栈当主视觉 |
| 对话流式 | **Vercel AI SDK**（`useChat` 等） | 对接网关 `/v1/chat/completions` |
| 图表 | Recharts | 用量、延迟、成本 |
| 状态 | Zustand（或局部 React state） | 管理台勿首期上 Redux |

### 3.3 明确不用

- Ant Design / Element Plus（企业后台模板感过重）
- 整站默认 shadcn 皮肤不换肤（可当脚手架，必须换令牌）
- 首屏重 Three.js / 大面积装饰 3D
- 紫白渐变、奶油底衬线+陶土色、报纸密排等常见 AI 模板审美

### 3.4 前端调用约定

```ts
import OpenAI from "openai";

// 生产环境：API Key 只放服务端（Route Handler / Server Action）
const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY!,
  baseURL: process.env.GATEWAY_BASE_URL!, // 例: http://127.0.0.1:4000/v1
});
```

浏览器侧优先走 **Next.js 服务端代理**，避免把 `master_key` 暴露到前端。

---

## 4. LiteLLM 克隆仓库取舍

本机已克隆：`D:\Users\taotao.huang\Desktop\tool\litellm`（tag：`v1.83.14-stable`）。

### 4.1 推荐策略（重要）

**业务项目不要把整个 LiteLLM monorepo 当作业务仓库。**

正确做法：

1. 新目录（如 `ai-gateway-platform/`）只放：自研前端 + `gateway/config.yaml` + `docker-compose.yml` + `.env`
2. 通过 **官方 Docker 镜像** 跑 Proxy，镜像版本对齐 `v1.83.14-stable`（或同版本号的 `-stable` 镜像）
3. `Desktop\tool\litellm` **仅作源码查阅 / 排障参考**，可不纳入业务 git

### 4.2 根目录取舍明细

以下基于克隆仓库根目录实际内容：

#### 日常「需要 / 值得看」

| 路径 | 用途 |
|------|------|
| `docker-compose.yml`、`docker-compose.hardened.yml` | 部署编排参考，业务仓自写精简版 |
| `Dockerfile`、`docker/` | 了解官方镜像构建方式（一般直接拉镜像即可） |
| `.env.example` | 环境变量清单参考 |
| `proxy_server_config.yaml`、`dev_config.yaml` | **config.yaml 写法参考** |
| `ARCHITECTURE.md`、`README.md` | 架构与能力说明 |
| `schema.prisma` | 开 Virtual Keys / DB 时参考表结构 |
| `model_prices_and_context_window.json` | 模型价与上下文窗口参考（只读） |
| `AGENTS.md` / `CONTRIBUTING.md` | 仅当需要贡献上游时阅读 |

#### 首期「不需要改、不必拷进业务仓」

| 路径 | 原因 |
|------|------|
| `litellm/`（Python 包源码） | 不 fork、不改上游；用镜像 |
| `ui/` | 官方 Dashboard；产品 UI 自研 |
| `tests/`、`ci_cd/`、`.circleci`、`.github` | 上游 CI / 测试，与业务无关 |
| `cookbook/` | 示例集合，按需网页查阅即可 |
| `enterprise/` | 企业授权能力，首期不做 |
| `litellm-js/` | JS SDK 侧；前端用 OpenAI SDK / AI SDK 即可 |
| `litellm-proxy-extras/` | 上游扩展包，首期不碰 |
| `deploy/`（含 Terraform 等） | 大规模部署，首期 Compose 足够 |
| `scripts/`、`db_scripts/` | 上游维护脚本 |
| `prometheus.yml` | 可观测性进阶，P2+ 再考虑 |
| `package.json` / `ui` 相关前端工程 | 官方 UI 构建，不用 |
| `.devcontainer`、`.semgrep`、各类 linter 配置 | 上游开发环境 |

#### 版本策略

| 做法 | 是否采用 |
|------|----------|
| 锁定 **`v1.83.14-stable`**（或同系列最新 `*-stable`） | 是 |
| 日常跟踪 `main` tip | **否** |
| 随意 checkout 功能 / staging 分支做生产 | **否** |

升级时：换镜像 tag + 回归 curl 两模型 + 读官方 changelog，再升业务依赖。

### 4.3 与业务仓的关系示意

```mermaid
flowchart TB
  subgraph ref [Reference_Only]
    Clone["Desktop/tool/litellm\nv1.83.14-stable"]
  end

  subgraph biz [Business_Repo]
    Docs[docs]
    Gw[gateway_config_compose]
    Web[web_Nextjs]
  end

  subgraph runtime [Runtime]
    Image["ghcr.io/berriai/litellm\n*-stable image"]
  end

  Clone -.查阅.-> Gw
  Gw --> Image
  Web --> Image
```

---

## 5. 网关配置规范

### 5.1 推荐业务目录结构（切换文件夹后按此创建）

```text
ai-gateway-platform/
  docs/
    AI网关平台-开发文档.md          # 本文档拷贝至此
  gateway/
    config.yaml                     # LiteLLM 模型与鉴权配置
    docker-compose.yml              # 仅网关（+ 可选 Postgres）
    .env.example
    .env                            # 本地密钥，勿提交 git
  web/                              # Next.js 前端工程
    package.json
    ...
  README.md
```

### 5.2 `gateway/config.yaml` 示例

```yaml
model_list:
  # ---------- DeepSeek 官网（LiteLLM 原生） ----------
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY

  - model_name: deepseek-reasoner
    litellm_params:
      model: deepseek/deepseek-reasoner
      api_key: os.environ/DEEPSEEK_API_KEY

  # ---------- 小米 MiMo 官网（OpenAI 兼容） ----------
  - model_name: mimo-v2.5-pro
    litellm_params:
      model: openai/mimo-v2.5-pro
      api_base: https://api.xiaomimimo.com/v1
      api_key: os.environ/MIMO_API_KEY

  - model_name: mimo-v2-flash
    litellm_params:
      model: openai/mimo-v2-flash
      api_base: https://api.xiaomimimo.com/v1
      api_key: os.environ/MIMO_API_KEY

litellm_settings:
  drop_params: true
  # set_verbose: true   # 排障时再开

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

说明：

- `model_name`：客户端传入的名字（对外契约）。
- `litellm_params.model`：真实路由；DeepSeek 用 `deepseek/` 前缀；MiMo 用 `openai/` + `api_base`。
- MiMo 端点以开放平台为准：`https://api.xiaomimimo.com/v1`（Key 在 `platform.xiaomimimo.com` 申请）。
- DeepSeek Key 在 DeepSeek 开放平台申请；LiteLLM 默认走其官方 API。

### 5.3 `gateway/.env.example`

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
MIMO_API_KEY=sk-your-mimo-key
LITELLM_MASTER_KEY=sk-your-gateway-master-key

# 前端用（仅服务端读取）
GATEWAY_BASE_URL=http://127.0.0.1:4000/v1
GATEWAY_API_KEY=sk-your-gateway-master-key
```

### 5.4 `gateway/docker-compose.yml` 示例（精简）

```yaml
services:
  litellm:
    # 镜像 tag 与锁定版本对齐；若 registry 命名略有差异，以官方文档当前 *-stable 为准
    image: docker.litellm.ai/berriai/litellm:v1.83.14-stable
    ports:
      - "4000:4000"
    volumes:
      - ./config.yaml:/app/config.yaml
    env_file:
      - .env
    command: ["--config", "/app/config.yaml", "--port", "4000", "--host", "0.0.0.0"]
    restart: unless-stopped
```

若该精确 tag 镜像拉取失败，可改用官方文档推荐的同版本 `ghcr.io/berriai/litellm:*-stable` 或 pip 方式：

```bash
pip install "litellm[proxy]==对应版本"
litellm --config ./config.yaml --port 4000
```

### 5.5 本地验证

```bash
# 健康 / 模型列表
curl http://127.0.0.1:4000/v1/models ^
  -H "Authorization: Bearer sk-your-gateway-master-key"

# DeepSeek
curl http://127.0.0.1:4000/v1/chat/completions ^
  -H "Authorization: Bearer sk-your-gateway-master-key" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"

# MiMo
curl http://127.0.0.1:4000/v1/chat/completions ^
  -H "Authorization: Bearer sk-your-gateway-master-key" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"mimo-v2.5-pro\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
```

### 5.6 核心 API 一览（前端对接）

| 能力 | 方法与路径 |
|------|------------|
| 对话 | `POST /v1/chat/completions`（`stream: true`） |
| 模型列表 | `GET /v1/models` |
| Virtual Key 等 | `/key/*`、`/user/*`（需配置 Postgres 后使用） |

---

## 6. 前端信息架构与视觉约束

### 6.1 页面结构

| 路由建议 | 职责 |
|----------|------|
| `/` | 品牌入口：产品名主视觉 + 一句定位 + 主 CTA（进 Playground / 创建 Key） |
| `/playground` | 全幅对话区；侧栏：模型、温度、max_tokens |
| `/models` | 网关已配置模型列表与状态 |
| `/keys` | Key 创建 / 吊销 / 额度（P2） |
| `/usage` | 调用量、费用、延迟图表（P2） |

### 6.2 视觉与交互硬约束

- **气质**：深色偏冷的工具体质（炭黑 + 弱噪点 / 径向光），避免大紫渐变。
- **第一视口**：品牌名 + 一句 headline + 一句支撑文案 + 一组 CTA；不要堆统计条、卡片墙。
- **Playground**：对话区全幅为主；少卡片化装饰。
- **动效**：路由淡入、消息流式显现、主按钮微反馈即可（2～3 处）。
- **字体**：展示字体 + 等宽日志字体；不用 Inter/Roboto/Arial 当门面。
- **组件**：Radix 行为 + 自研皮肤；去掉无交互意义的边框/阴影「假卡片」。

### 6.3 Playground 数据流

```mermaid
sequenceDiagram
  participant UI as Playground_UI
  participant API as Next_RouteHandler
  participant GW as LiteLLM_Proxy
  participant UP as DeepSeek_or_MiMo

  UI->>API: messages_model_stream
  API->>GW: POST_/v1/chat/completions
  GW->>UP: provider_request
  UP-->>GW: tokens_SSE
  GW-->>API: OpenAI_SSE
  API-->>UI: streamed_text
```

---

## 7. 分期开发路线

### P0 — 网关打通（1～2 天）

- [ ] 新建 `ai-gateway-platform` 目录结构
- [ ] 写入 `gateway/config.yaml`、`.env`、`docker-compose.yml`
- [ ] 申请 DeepSeek / MiMo API Key
- [ ] 启动 Proxy，curl 验证两个模型别名
- [ ] 确认 GitHub 代理可用（若需拉镜像/文档）

### P1 — 前端骨架 + Playground（核心）

- [ ] `create-next-app` 初始化 `web/`（TS + Tailwind）
- [ ] 设计令牌（CSS 变量）与基础布局
- [ ] 服务端 Route Handler 代理到网关
- [ ] Playground：模型选择 + 流式输出（AI SDK）
- [ ] `/models` 拉取 `GET /v1/models`

### P2 — Key 与用量

- [ ] Compose 增加 Postgres，配置 LiteLLM 数据库
- [ ] Virtual Keys 创建与列表页
- [ ] 用量 / 花费图表（Recharts）

### P3 — 视觉与体验打磨

- [ ] 落地页品牌构图与动效
- [ ] Playground 细节（停止生成、错误态、空态）
- [ ] 性能与加载态

---

## 8. 环境与排障

### 8.1 GitHub 克隆失败（已处理过的场景）

**现象 A**：`Failed to connect to github.com port 443`

- 原因：直连 GitHub 被墙 / 超时。
- 处理：开启 Clash，系统或 Git 走本地 HTTP 代理端口 **7890**。

已配置的全局 Git 代理：

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

关闭 Clash 或不需要代理时取消：

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

**现象 B**：`git@github.com: Permission denied (publickey)`

- 原因：本机未配置可用 SSH Key。
- 处理：首期统一用 **HTTPS + 代理** 克隆即可，不必强上 SSH。

### 8.2 网关常见问题

| 问题 | 排查 |
|------|------|
| 401 | `LITELLM_MASTER_KEY` 与请求 Bearer 是否一致 |
| 上游 401/403 | `DEEPSEEK_API_KEY` / `MIMO_API_KEY` 是否有效 |
| MiMo 404 / 模型不存在 | `model` 名与开放平台文档是否一致；`api_base` 是否含 `/v1` |
| 流式无输出 | 客户端是否按 SSE 解析；代理是否缓冲响应 |
| Docker 拉镜像失败 | 同样需要代理或镜像加速；核对 tag 是否存在 |

### 8.3 本机参考路径速查

| 用途 | 路径 |
|------|------|
| LiteLLM 源码参考 | `D:\Users\taotao.huang\Desktop\tool\litellm` |
| 本文档（当前） | `D:\Users\taotao.huang\Desktop\test1\AI网关平台-开发文档.md` |
| 建议新工程根 | 自行选定文件夹后按第 5.1 节创建 |

---

## 9. 切换文件夹后的开工检查清单

按顺序执行：

1. **新建** `ai-gateway-platform/`，把本文档复制到 `docs/`。
2. **创建** `gateway/config.yaml`、`.env`、`docker-compose.yml`（抄第 5 节，填入真实 Key）。
3. **启动网关**：`docker compose up -d`（或 pip + `litellm --config`）。
4. **curl** 验证 `deepseek-chat` 与 `mimo-v2.5-pro`。
5. **初始化前端**：在 `web/` 用 Next.js 15 + TS + Tailwind。
6. **配置** `GATEWAY_BASE_URL` / `GATEWAY_API_KEY`（仅服务端）。
7. **实现** Playground 流式对话。
8. **Cursor** 用「打开文件夹」切到 `ai-gateway-platform`，再继续迭代 UI。

---

## 10. 决策摘要（一页纸）

| 决策项 | 结论 |
|--------|------|
| 网关 | LiteLLM Proxy，`v1.83.14-stable` |
| 上游 | DeepSeek 官网 + MiMo 官网 |
| 前端 | Next.js 15 + Tailwind v4 + Motion + Radix 自研皮 + AI SDK |
| 官方 UI | 不用 |
| 源码仓 | 不 fork；Docker 跑；本机 clone 仅参考 |
| 业务仓内容 | `docs/` + `gateway/` + `web/` |
| 鉴权 | 先 master_key，再 Virtual Keys + Postgres |
| Git 代理 | Clash `127.0.0.1:7890` |

---

*文档结束。切换目录后以本文为唯一开工依据；架构变更时先改本文再改代码。*
