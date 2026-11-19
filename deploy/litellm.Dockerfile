# LiteLLM 网关镜像（与本机运行时同版本 1.91.1，国内构建友好）。
# 不用官方 v1.83.14-stable 镜像：版本落后会让 usage_breakdown_compat 等补丁失效
# （MiMo 截断思考超收修复依赖 1.91.1 的成本计算内部结构）。
# 国内构建：pip 走腾讯云镜像（VPC 内免流快速），prisma 引擎走 npmmirror 二进制镜像。
FROM python:3.10-slim-bookworm

ARG PIP_INDEX=https://mirrors.tencent.com/pypi/simple
ENV PIP_INDEX_URL=${PIP_INDEX} \
    PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "litellm[proxy]==1.91.1" prisma

# DB 模式需要 prisma generate（schema 在 litellm 包内）；引擎二进制在构建期下载 baked 进镜像
RUN python -m prisma generate \
  --schema "$(python -c 'import litellm, os; print(os.path.join(os.path.dirname(litellm.__file__), "proxy", "schema.prisma"))')"

WORKDIR /app
EXPOSE 4000
ENTRYPOINT ["python", "-m", "litellm.proxy.proxy_cli"]