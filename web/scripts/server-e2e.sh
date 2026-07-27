#!/usr/bin/env bash
# 服务器验收包装：从环境或 .env 加载后跑 server-e2e.mjs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB_DIR="$ROOT/web"

if [[ -f "$WEB_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$WEB_DIR/.env"
  set +a
fi
if [[ -f "$ROOT/gateway/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/gateway/.env"
  set +a
fi

export WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
export GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://127.0.0.1:4000}"
export REQUIRE_VIRTUAL_KEY="${REQUIRE_VIRTUAL_KEY:-true}"
export ALLOW_TEST_HOOKS="${ALLOW_TEST_HOOKS:-true}"

echo "WEB_BASE_URL=$WEB_BASE_URL"
echo "GATEWAY_BASE_URL=$GATEWAY_BASE_URL"
echo "REQUIRE_VIRTUAL_KEY=$REQUIRE_VIRTUAL_KEY"

exec node "$WEB_DIR/scripts/server-e2e.mjs"
