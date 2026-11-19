# Multi-stage Next.js (Prisma + libSQL) for ai-gateway-platform web
# 国内构建：--build-arg NPM_REGISTRY=https://registry.npmmirror.com（默认已是）
FROM node:22-bookworm-slim AS deps
ARG NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
RUN sed -i 's|deb.debian.org|mirrors.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY web/package.json web/package-lock.json ./
# --ignore-scripts：此阶段只有 package.json，postinstall 的 prisma generate 找不到 schema；
# 留到 builder 阶段（有完整源码 + PRISMA_ENGINES_MIRROR）再 generate
RUN npm ci --ignore-scripts --registry=${NPM_REGISTRY}

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN sed -i 's|deb.debian.org|mirrors.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma generate needs a placeholder URL at build time
ENV DATABASE_URL="file:./dev.db"
# prisma 引擎二进制走 npmmirror（官方 binaries.prisma.sh 国内常被断连）
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN sed -i 's|deb.debian.org|mirrors.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
COPY deploy/web-entrypoint.sh /usr/local/bin/web-entrypoint.sh
# 去掉 Windows CRLF（否则 #!/bin/sh\r 报 no such file or directory）
RUN sed -i 's/\r$//' /usr/local/bin/web-entrypoint.sh && chmod +x /usr/local/bin/web-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/web-entrypoint.sh"]
