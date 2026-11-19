#!/usr/bin/env bash
# 用 PM2 纳管三件套：Postgres → LiteLLM 网关 :4000 → Web 控制台 :3000（生产模式）。
# 前置：npm install -g pm2；web 已 npm run build；Postgres 数据目录已 init
# （scripts/local-postgres.sh init）。重复执行安全（先删旧纳管再拉起）。
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd -W 2>/dev/null || pwd)"

command -v pm2 >/dev/null || { echo "缺少 pm2：npm install -g pm2" >&2; exit 1; }
mkdir -p logs

# 清理游离的旧进程（避免端口被占导致 LiteLLM 静默改绑随机端口）
for port in 3000 4000 5432; do
  pid="$(netstat -ano | grep -E "LISTENING" | grep -E ":$port " | awk '{print $5}' | sort -u | head -1 || true)"
  if [ -n "$pid" ]; then
    echo "端口 $port 被 PID $pid 占用，先停止（旧进程不纳管会被 PM2 重启风暴）"
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  fi
done
sleep 2

pm2 delete aigw-web aigw-gateway aigw-postgres >/dev/null 2>&1 || true
# 清理孤儿 prisma 引擎（网关被强杀后可能残留；只有网关用它，全杀安全）
taskkill //IM query-engine-windows.exe //F >/dev/null 2>&1 || true

# 1) Postgres 先起并等就绪
pm2 start deploy/pm2/ecosystem.config.cjs --only aigw-postgres
for i in $(seq 1 30); do
  if "C:/Users/Public/aigw-pgsql/bin/pg_isready.exe" -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    echo "Postgres 就绪"; break
  fi
  [ "$i" = 30 ] && { echo "Postgres 30s 未就绪，见 logs/pm2-postgres.log" >&2; exit 1; }
  sleep 1
done

# 2) 网关 + Web
pm2 start deploy/pm2/ecosystem.config.cjs --only aigw-gateway
pm2 start deploy/pm2/ecosystem.config.cjs --only aigw-web

# 3) 等网关 :4000 真的绑定成功（LiteLLM 端口被占时会静默改绑随机端口；
#    冷启动含 prisma migrate + 模型注册，可能要 1-2 分钟）
ok=""
for i in $(seq 1 150); do
  if curl -s -m 2 http://127.0.0.1:4000/health/liveliness >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ -n "$ok" ] || { echo "网关 150s 未在 :4000 就绪，见 logs/pm2-gateway.log" >&2; exit 1; }
# 确认日志里是 4000 而不是静默改绑的随机端口
grep -q "Uvicorn running on http://0.0.0.0:4000" logs/pm2-gateway.log \
  || echo "⚠ 日志未见 0.0.0.0:4000 绑定行，请人工核对 logs/pm2-gateway.log"

pm2 save --force
pm2 status
echo ""
echo "✔ 三件套已纳管。kill 任一进程 PM2 会自动拉起；开机自启见 scripts/pm2-boot-install.sh"