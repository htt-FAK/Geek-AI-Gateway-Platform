#!/usr/bin/env bash
# Create deploy/.env from example and fill random secrets if still placeholders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
EXAMPLE="$DEPLOY_DIR/.env.example"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "ERROR: missing $EXAMPLE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example"
else
  echo "Using existing $ENV_FILE"
fi

rand_hex() {
  openssl rand -hex "$1"
}

rand_b64() {
  openssl rand -base64 "$1" | tr -d '\n'
}

set_if_placeholder() {
  local key="$1"
  local value="$2"
  local current
  current="$(grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d= -f2- || true)"
  case "$current" in
    ""|sk-change-me*|replace-with*|admin-change-me*|MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=)
      if grep -qE "^${key}=" "$ENV_FILE"; then
        # portable in-place replace
        awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" >"$ENV_FILE.tmp"
        mv "$ENV_FILE.tmp" "$ENV_FILE"
      else
        echo "${key}=${value}" >>"$ENV_FILE"
      fi
      echo "Generated $key"
      ;;
  esac
}

set_if_placeholder "LITELLM_MASTER_KEY" "sk-$(rand_hex 24)"
set_if_placeholder "ADMIN_TOKEN" "admin-$(rand_hex 16)"
set_if_placeholder "AUTH_SECRET" "$(rand_hex 32)"
set_if_placeholder "CREDENTIALS_ENCRYPTION_KEY" "$(rand_b64 32)"

echo ""
echo "Review upstream keys in $ENV_FILE:"
echo "  DEEPSEEK_API_KEY / MIMO_API_KEY must be real values (not sk-your-*)."
