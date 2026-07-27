#!/usr/bin/env bash
# One-click acceptance: toggles ALLOW_TEST_HOOKS, runs server-e2e, restores hooks flag.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE")

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

set_env_key() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" >"$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >>"$ENV_FILE"
  fi
}

ORIG_HOOKS="$(get_env ALLOW_TEST_HOOKS)"
ORIG_HOOKS="${ORIG_HOOKS:-false}"

restore_hooks() {
  log "Restoring ALLOW_TEST_HOOKS=$ORIG_HOOKS"
  set_env_key "ALLOW_TEST_HOOKS" "$ORIG_HOOKS"
  "${COMPOSE[@]}" up -d web >/dev/null
}
trap restore_hooks EXIT

log "Enabling ALLOW_TEST_HOOKS for e2e..."
set_env_key "ALLOW_TEST_HOOKS" "true"
"${COMPOSE[@]}" up -d web

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
export ALLOW_TEST_HOOKS=true
export LITELLM_MASTER_KEY="$(get_env LITELLM_MASTER_KEY)"
export ADMIN_TOKEN="$(get_env ADMIN_TOKEN)"
export DEFAULT_USER_PASSWORD="$(get_env DEFAULT_USER_PASSWORD)"
export NO_PROXY="${NO_PROXY:-127.0.0.1,localhost}"
export no_proxy="${no_proxy:-127.0.0.1,localhost}"

log "Running server-e2e (REQUIRE_VIRTUAL_KEY=true)..."
node "$ROOT/web/scripts/server-e2e.mjs"

echo ""
echo "=== TEST_OK (see SERVER_E2E_OK above) ==="
