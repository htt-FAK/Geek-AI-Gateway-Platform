# AI 网关平台

业务仓（精简）：只含配置与自研前端，**不包含** LiteLLM monorepo 源码。

## 结构

```text
ai-gateway-platform/
  docs/AI网关平台-开发文档.md   # 开工唯一依据
  gateway/                     # LiteLLM Proxy 配置
  web/                         # Next.js 前端（P1）
```

## 上游

- DeepSeek 官网 API
- 小米 MiMo 官网 API

网关版本锁定：`v1.83.14-stable`（Docker 镜像或等价 pip）。

## 启动网关

```powershell
cd gateway
copy .env.example .env   # 首次：填入真实 Key
# Docker（推荐，需本机已装 Docker）
docker compose up -d

# 或 pip 回退
# pip install "litellm[proxy]==1.83.14"
# litellm --config ./config.yaml --port 4000
```

验证：

```powershell
curl http://127.0.0.1:4000/v1/models -H "Authorization: Bearer <LITELLM_MASTER_KEY>"
```

## 参考

- 开发文档：`docs/AI网关平台-开发文档.md`
- LiteLLM 源码查阅（勿当业务仓）：`D:\Users\taotao.huang\Desktop\tool\litellm`
