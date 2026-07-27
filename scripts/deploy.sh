#!/usr/bin/env bash
# One-click deploy: Postgres + LiteLLM + Web (Docker Compose)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE")

log() { echo "[deploy] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd docker
docker compose version >/dev/null 2>&1 || die "docker compose v2 required"

bash "$ROOT/scripts/env-init.sh"

[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r'
}

DS_KEY="$(get_env DEEPSEEK_API_KEY)"
MIMO_KEY="$(get_env MIMO_API_KEY)"
MASTER="$(get_env LITELLM_MASTER_KEY)"

[[ -n "$DS_KEY" && "$DS_KEY" != sk-your-* ]] || die "Set a real DEEPSEEK_API_KEY in $ENV_FILE"
[[ -n "$MIMO_KEY" && "$MIMO_KEY" != sk-your-* ]] || die "Set a real MIMO_API_KEY in $ENV_FILE"
[[ -n "$MASTER" && "$MASTER" != sk-change-me* && "$MASTER" != sk-your-* ]] || die "LITELLM_MASTER_KEY looks unset in $ENV_FILE"

log "Building and starting stack..."
"${COMPOSE[@]}" up -d --build

wait_http() {
  local url="$1"
  local name="$2"
  local n=0
  log "Waiting for $name ($url)..."
  until curl -fsS "$url" >/dev/null 2>&1; do
    n=$((n + 1))
    if [[ $n -gt 60 ]]; then
      die "timeout waiting for $name"
    fi
    sleep 3
  done
  log "$name is up"
}

wait_http "http://127.0.0.1:4000/health/liveliness" "LiteLLM"
wait_http "http://127.0.0.1:3000/login" "Web"

log "Probing Virtual Key (/key/generate)..."
KEY_PROBE="$(curl -fsS -X POST "http://127.0.0.1:4000/key/generate" \
  -H "Authorization: Bearer ${MASTER}" \
  -H "Content-Type: application/json" \
  -d '{"models":["deepseek-v4-flash"],"max_budget":50,"budget_duration":"24h","key_alias":"deploy-probe"}' \
  || true)"
echo "$KEY_PROBE" | grep -qE '"key"|"token"' || die "Virtual Key probe failed. Check Postgres + LiteLLM logs: ${COMPOSE[*]} logs litellm"
log "Virtual Key OK"

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
[[ -z "$HOST_IP" ]] && HOST_IP="127.0.0.1"

echo ""
echo "=== DEPLOY_OK ==="
echo "Web:     http://${HOST_IP}:3000/login"
echo "Gateway: http://${HOST_IP}:4000/v1/models"
echo "Next:    ./scripts/test.sh"
echo ""
