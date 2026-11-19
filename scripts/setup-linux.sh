#!/usr/bin/env bash
# 腾讯云 Linux 裸机部署（纯国内源，不用 Docker / 不拉境外资源）。
# 适用：Ubuntu 22.04（推荐，Python 3.10 与本机一致）/ 24.04（Python 3.12）。
# 以普通用户（有 sudo，腾讯云默认 ubuntu/lighthouse 免密）在仓库根目录执行：
#   ./scripts/setup-linux.sh
# 源：apt=腾讯云镜像（CVM 默认已是）/ pip=mirrors.tencent.com / npm=node=prisma 引擎=npmmirror。
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"
log() { echo -e "\n[setup] $*"; }
die() { echo "[setup] ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" != 0 ]] || die "请用普通用户（带 sudo）执行，不要直接 root（PM2 以当前用户守护）"
sudo -n true 2>/dev/null || die "需要免密 sudo（腾讯云默认用户具备）"
. /etc/os-release
[[ "$ID" == ubuntu ]] || die "仅支持 Ubuntu（当前 $ID）"

PIP_INDEX="https://mirrors.tencent.com/pypi/simple"
NPM_REG="https://registry.npmmirror.com"
NODE_VER="v20.18.1"
export PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma"

# ---------- 1. 系统依赖（apt 走腾讯云镜像，CVM 默认已配置） ----------
log "apt 安装 postgresql / python3-venv / nginx ..."
sudo apt-get update -y
sudo apt-get install -y postgresql python3-venv python3-pip nginx curl ca-certificates openssl xz-utils
PY="$(command -v python3)"
log "Python: $($PY --version 2>&1)（22.04=3.10 最佳；24.04=3.12 亦可）"

# ---------- 2. Postgres：建 litellm 角色与库（systemd 原生管理，开机自启） ----------
PG_PASS="$(openssl rand -hex 16)"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='litellm'" | grep -q 1; then
  log "Postgres 角色 litellm 已存在，沿用（密码见 gateway/.env DATABASE_URL）"
  PG_PASS=""  # 不覆盖已有密码
else
  sudo -u postgres psql -c "CREATE ROLE litellm LOGIN PASSWORD '${PG_PASS}';"
  sudo -u postgres psql -c "CREATE DATABASE litellm OWNER litellm;"
  log "Postgres 角色/库已创建"
fi
sudo systemctl enable --now postgresql

# ---------- 3. Node 20（npmmirror 二进制，免境外） ----------
if command -v node >/dev/null && node -e 'process.exit(process.versions.node.split(".")[0]>=20?0:1)'; then
  log "Node 已存在: $(node --version)"
else
  log "安装 Node ${NODE_VER}（npmmirror）..."
  curl -fsSL "https://npmmirror.com/mirrors/node/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz" -o /tmp/node.tar.xz
  sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.xz
  log "Node: $(node --version)"
fi

# ---------- 4. Python venv + litellm 1.91.1（腾讯云 pypi） ----------
log "创建 venv 并安装 litellm[proxy]==1.91.1 ..."
[[ -d .venv ]] || "$PY" -m venv .venv
.venv/bin/pip install -q -i "$PIP_INDEX" --upgrade pip
.venv/bin/pip install -q -i "$PIP_INDEX" "litellm[proxy]==1.91.1" prisma
SCHEMA="$(.venv/bin/python -c 'import litellm,os;print(os.path.join(os.path.dirname(litellm.__file__),"proxy","schema.prisma"))')"
log "prisma generate（引擎走 npmmirror）..."
.venv/bin/python -m prisma generate --schema "$SCHEMA"

# ---------- 5. gateway/.env ----------
if [[ ! -f gateway/.env ]]; then
  cp gateway/.env.example gateway/.env
  MASTER="sk-geek-$(openssl rand -hex 16)"
  sed -i "s|^LITELLM_MASTER_KEY=.*|LITELLM_MASTER_KEY=${MASTER}|" gateway/.env
  if [[ -n "$PG_PASS" ]]; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://litellm:${PG_PASS}@127.0.0.1:5432/litellm|" gateway/.env
  fi
  log "gateway/.env 已生成（MASTER_KEY 随机）"
else
  log "gateway/.env 已存在，沿用"
fi
MASTER="$(grep -E '^LITELLM_MASTER_KEY=' gateway/.env | cut -d= -f2-)"

# ---------- 6. web/.env ----------
if [[ ! -f web/.env ]]; then
  cat > web/.env <<EOF
DATABASE_URL="file:${REPO}/web/dev.db"
GATEWAY_BASE_URL=http://127.0.0.1:4000
LITELLM_MASTER_KEY=${MASTER}
DEFAULT_USER_PASSWORD=$(openssl rand -base64 18 | tr -d '\n=' | tr '+/' '-_')
AUTH_SECRET=$(openssl rand -hex 32)
CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
ADMIN_TOKEN=adm-$(openssl rand -hex 24)
ALLOW_TEST_HOOKS=false
EOF
  log "web/.env 已生成（全部强随机；默认密码见文件，首登强制改密）"
else
  log "web/.env 已存在，沿用"
fi

# ---------- 7. Web 构建（npm 走 npmmirror） ----------
log "npm ci + prisma generate + next build ..."
cd web
npm ci --registry="$NPM_REG"
npx prisma generate
npm run build
npx prisma migrate deploy
cd "$REPO"

# ---------- 8. PM2 守护 + 开机自启 ----------
log "安装 PM2 并纳管网关 + Web ..."
command -v pm2 >/dev/null || npm install -g pm2 --registry="$NPM_REG"
mkdir -p logs
pm2 delete aigw-gateway aigw-web >/dev/null 2>&1 || true
pm2 start deploy/pm2/ecosystem.linux.cjs
pm2 save
log "配置 PM2 开机自启（systemd）..."
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 | sudo bash || log "（若上行失败，手动执行 pm2 startup 提示的 sudo 命令）"
pm2 save

# ---------- 9. 就绪探针 ----------
log "等待网关就绪..."
for i in $(seq 1 90); do
  curl -fsS -m 2 http://127.0.0.1:4000/health/readiness 2>/dev/null | grep -q '"db":"connected"' && { log "网关 DB connected（${i}s）"; break; }
  sleep 2
done
pm2 status

cat <<EOF

=== SETUP_OK ===
下一步（必做）：
1. 填上游 Key：vim gateway/.env
   DEEPSEEK_API_KEY / MIMO_API_KEY / DASHSCOPE_API_KEY(+DASHSCOPE_API_BASE 专属 endpoint) / 可选 XFYUN/SILICONFLOW
   改完：pm2 restart aigw-gateway --update-env
2. HTTPS 反代（对外必须，Secure Cookie）：见 docs/部署-腾讯云.md §6
   Nginx 已装；腾讯云免费证书 + 443→127.0.0.1:3000，务必 proxy_buffering off（SSE 流式）
3. 安全组只放行 80/443 + 受限 22；勿放行 3000/4000/5432
4. 验证：pm2 status；curl http://127.0.0.1:3000/login；./scripts/test.sh
5. 备份：./scripts/backup.sh（Docker 版）——裸机版用 pg_dump + cp web/dev.db（见运维手册 §8）
管理员导入用户：ADMIN_TOKEN 在 web/.env；演示账号默认密码在 web/.env DEFAULT_USER_PASSWORD（首登强制改密）
EOF