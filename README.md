# AI 网关平台

业务仓（精简）：LiteLLM Proxy 配置 + 自研 Web BFF（手机号登录 / Playground），**不包含** LiteLLM monorepo 源码。

## 结构

```text
ai-gateway-platform/
  deploy/                       # 服务器 Docker Compose + Web 镜像
  scripts/deploy.sh             # 一键部署
  scripts/test.sh               # 一键验收
  scripts/env-init.sh           # 生成 deploy/.env 随机密钥
  gateway/                      # LiteLLM 配置 / 峰谷 / 价目
  web/                          # Next.js BFF
  docs/
```

## 上游与模型别名

DeepSeek：`deepseek-v4-flash`、`deepseek-v4-pro`  
MiMo：`mimo-v2.5-pro`、`mimo-v2.5-pro-ultraspeed`、`mimo-v2.5`、ASR/TTS 系列  

网关版本锁定：`v1.83.14-stable`。

## 服务器一键部署（Linux + Docker）

要求：Docker Compose v2、宿主机 Node 18+（仅 `test.sh` 需要）。

```bash
chmod +x scripts/*.sh deploy/web-entrypoint.sh
./scripts/env-init.sh
# 编辑 deploy/.env：填入真实 DEEPSEEK_API_KEY / MIMO_API_KEY
./scripts/deploy.sh
./scripts/test.sh          # 期望 SERVER_E2E_OK（REQUIRE_VIRTUAL_KEY=true）
```

部署后：

- Web：`http://<服务器>:3000/login`
- Gateway：`http://<服务器>:4000`（Virtual Key / Spend 依赖 Compose 内 Postgres）

`test.sh` 会临时打开 `ALLOW_TEST_HOOKS`，结束后自动改回原值。

## 本机开发（Windows / 无 Docker）

### 网关

```powershell
cd gateway
copy .env.example .env   # 填入真实 Key
# 有 Docker：docker compose up -d
# 无 Docker：pip install "litellm[proxy]==1.83.14"
# $env:PYTHONPATH=(Get-Location).Path
# litellm --config ./config.yaml --port 4000 --host 0.0.0.0
```

### Web

```powershell
cd web
copy .env.example .env
# GATEWAY_BASE_URL=http://127.0.0.1:4000（不要带 /v1）；Master Key 与 gateway 一致
npm install
npx prisma migrate deploy
npm run dev
```

验收：

```powershell
cd web
$env:REQUIRE_VIRTUAL_KEY="true"   # 有 Postgres+VK 时；否则 false
npm run test:server
```

## 参考

- 交接：`docs/实现交接-手机号登录与网关.md`
- 开发文档：`docs/AI网关平台-开发文档.md`（或仓库根目录同名文件）
- LiteLLM 源码查阅（勿当业务仓）：`D:\Users\taotao.huang\Desktop\tool\litellm`
