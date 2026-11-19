#!/usr/bin/env bash
# One-click acceptance: runs server-e2e against the running stack.
# 余额闸门由「0 余额 → 402 → 充值 → chat」驱动，无需临时打开 ALLOW_TEST_HOOKS（生产保持 false）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"

log() { echo "[test] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd docker
need_cmd node
need_cmd curl
docker compose version >/dev/null 2>&1 || die "docker compose v2 required"
[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE — run ./scripts/deploy.sh first"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[[ "$NODE_MAJOR" -ge 18 ]] || die "Node 18+ required (found $(node -v))"

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r'
}

log "Waiting for web..."
n=0
until curl -fsS "http://127.0.0.1:3000/login" >/dev/null 2>&1; do
  n=$((n + 1))
  [[ $n -gt 40 ]] && die "web not ready"
  sleep 3
done

export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
export GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://127.0.0.1:4000}"
export REQUIRE_VIRTUAL_KEY=true
export LITELLM_MASTER_KEY="$(get_env LITELLM_MASTER_KEY)"
export ADMIN_TOKEN="$(get_env ADMIN_TOKEN)"
export DEFAULT_USER_PASSWORD="$(get_env DEFAULT_USER_PASSWORD)"
export NO_PROXY="${NO_PROXY:-127.0.0.1,localhost}"
export no_proxy="${no_proxy:-127.0.0.1,localhost}"

log "Running server-e2e (REQUIRE_VIRTUAL_KEY=true)..."
node "$ROOT/web/scripts/server-e2e.mjs"

echo ""
echo "=== TEST_OK (see SERVER_E2E_OK above) ==="
