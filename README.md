# 高科极客 AI 网关平台

<p align="center">
  <strong>有趣的人，在这里调用世界</strong>
</p>

<p align="center">
  自研 Web 控制台 + LiteLLM Proxy 的业务仓<br/>
  手机号登录 · Virtual Key · 用量看板 · 调试台 · 多皮肤主题
</p>

<p align="center">
  <a href="#功能亮点">功能</a> ·
  <a href="#仓库结构">结构</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#上游模型">模型</a> ·
  <a href="#部署">部署</a> ·
  <a href="#文档">文档</a>
</p>

---

面向团队内部的 **OpenAI 兼容 AI 网关**：统一接入 DeepSeek / 小米 MiMo，配齐登录、密钥、预算、用量与 Playground。  
本仓库是精简业务仓，**不包含** LiteLLM monorepo 源码；网关运行镜像锁定 `v1.83.14-stable`。

| 入口 | 说明 |
|------|------|
| Web 控制台 | `http://<host>:3000` — 登录、看板、模型、密钥、调试台、管理 |
| Gateway API | `http://<host>:4000/v1` — OpenAI 兼容，Bearer Virtual Key |

---

## 功能亮点

- **统一网关** — DeepSeek / MiMo 多模型别名，Virtual Key + Spend / 预算
- **控制台** — 手机号登录、日周月预算、用量曲线、密钥一键复制与轮换
- **调试台** — 流式对话、思考深度档位（按模型）、调用示例一键复制
- **模型文档** — `/models` 每行可查看官方说明与本网关 curl / Python 示例
- **主题皮肤** — Minimal / TRAE / Golden / Google / Doubao / Claude / Apple / 21th；进入页品牌钉死
- **一键运维** — `deploy/` Compose + `scripts/deploy.sh` / `test.sh`

---

## 仓库结构

```text
ai-gateway-platform/
├── deploy/          # Docker Compose、Web 镜像、entrypoint
├── gateway/         # LiteLLM config、峰谷价、model_catalog
├── web/             # Next.js 控制台 + BFF（Prisma）
├── scripts/         # env-init / deploy / test
├── docs/            # 交接与说明
└── openspec/        # 变更规格（可选）
```

| 目录 | 职责 |
|------|------|
| [`gateway/`](gateway/) | Proxy 配置、上游 Key、峰时倍率、价目 JSON |
| [`web/`](web/) | 登录会话、API、看板、Playground、主题皮肤 |
| [`deploy/`](deploy/) | 生产 Compose：Postgres + LiteLLM + Web |
| [`scripts/`](scripts/) | 初始化密钥、部署、端到端验收 |

---

## 快速开始

### 本机开发（Windows）

**1. 网关**

```powershell
cd gateway
copy .env.example .env   # 填入 DEEPSEEK_API_KEY / MIMO_API_KEY
# 有 Docker：docker compose up -d
# 无 Docker：pip install "litellm[proxy]==1.83.14"
# $env:PYTHONPATH = (Get-Location).Path
# litellm --config ./config.yaml --port 4000 --host 0.0.0.0
```

**2. Web**

```powershell
cd web
copy .env.example .env
# GATEWAY_BASE_URL=http://127.0.0.1:4000  （不要带 /v1）
# LITELLM_MASTER_KEY 与 gateway 一致
npm install
npx prisma migrate deploy
npm run dev
```

浏览器打开 [http://localhost:3000/login](http://localhost:3000/login)。

**3. 验收（可选）**

```powershell
cd web
$env:REQUIRE_VIRTUAL_KEY = "true"   # 有 Postgres + VK 时；否则 "false"
npm run test:server
```

### 服务器一键部署（Linux + Docker）

要求：Docker Compose v2；宿主机 Node 18+（仅 `test.sh` 需要）。

```bash
chmod +x scripts/*.sh deploy/web-entrypoint.sh
./scripts/env-init.sh
# 编辑 deploy/.env：填入真实 DEEPSEEK_API_KEY / MIMO_API_KEY
./scripts/deploy.sh
./scripts/test.sh          # 期望 SERVER_E2E_OK（REQUIRE_VIRTUAL_KEY=true）
```

部署后：

| 服务 | 地址 |
|------|------|
| Web | `http://<服务器>:3000/login` |
| Gateway | `http://<服务器>:4000` |

> `test.sh` 会临时打开 `ALLOW_TEST_HOOKS`，结束后自动恢复。

---

## 上游模型

| Provider | 模型 ID | 说明 |
|----------|---------|------|
| DeepSeek | `deepseek-v4-flash` | 更快更省 |
| DeepSeek | `deepseek-v4-pro` | 旗舰 · 思考档 |
| MiMo | `mimo-v2.5-pro` | 文本旗舰 |
| MiMo | `mimo-v2.5-pro-ultraspeed` | 高速档 |
| MiMo | `mimo-v2.5` | 全模态 |
| MiMo | `mimo-v2.5-asr` / `*-tts*` | 语音识别 / 合成 |

调用时：

```bash
curl "$GATEWAY/v1/chat/completions" \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hello"}]}'
```

控制台 **模型** 页可对每个模型打开「文档」，查看官方说明与完整示例。

---

## 架构一览

```text
┌─────────────┐     session      ┌──────────────┐
│  Browser    │ ───────────────► │  Next.js Web │
│  控制台     │                  │  BFF + UI    │
└─────────────┘                  └──────┬───────┘
                                        │ Master / VK
                                        ▼
                                 ┌──────────────┐
                                 │ LiteLLM      │
                                 │ Proxy :4000  │
                                 └──────┬───────┘
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                     DeepSeek API                 MiMo API
```

- 用户持有 **Virtual Key**，经网关计费与限流  
- Web 用 Master Key 做管理面（建用户、重发 Key、Spend 查询）  
- 用量看板读业务库 + 网关 Spend 汇总

---

## 主题皮肤

控制台支持多套皮肤（侧栏 / 按钮 / 字体 / Composer 气质不同），在主题设置中切换：

`Minimal` · `TRAE` · `Golden Time` · `Google` · `Doubao` · `Claude` · `Apple` · `21th`

进入页（`/`、`/login`）保持品牌钉死，不随皮肤漂移。

---

## 文档

| 文档 | 路径 |
|------|------|
| 实现交接 | [`docs/实现交接-手机号登录与网关.md`](docs/实现交接-手机号登录与网关.md) |
| 开发文档 | 仓库根目录 `AI网关平台-开发文档.md` |
| 前端设计规范 | 仓库根目录 `AI网关平台-前端设计规范.md` |
| Web 说明 | [`web/README.md`](web/README.md) |

环境变量模板：[`gateway/.env.example`](gateway/.env.example) · [`web/.env.example`](web/.env.example) · [`deploy/.env.example`](deploy/.env.example)

---

## 安全提示

- **不要**把真实 API Key、Master Key、用户 Virtual Key 提交进 Git  
- 仅提交 `*.env.example`；本地与服务器使用 `deploy/.env` / `web/.env`  
- 公开仓库请轮换已暴露过的密钥

---

## License

内部业务项目。未声明开源协议前，请勿擅自公开发布或二次分发敏感配置。
