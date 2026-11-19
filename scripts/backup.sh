#!/usr/bin/env bash
# 备份（Docker Compose 部署）：Postgres 密钥库 pg_dump + Web SQLite 应用库。
# 用法: ./scripts/backup.sh [输出根目录]   默认 ./backup
# 建议 cron 每日凌晨：0 3 * * * cd /opt/geek-ai-gateway && ./scripts/backup.sh >> backup/cron.log 2>&1
# 保留策略：默认保留最近 14 份，可按需调整 KEEP。
set -euo pipefail
cd "$(dirname "$0")/.."

OUT_ROOT="${1:-backup}"
KEEP="${KEEP:-14}"
STAMP="$(date +%F-%H%M)"
DIR="$OUT_ROOT/$STAMP"
mkdir -p "$DIR"
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

echo "[backup] Postgres pg_dump..."
"${COMPOSE[@]}" exec -T postgres pg_dump -U litellm -d litellm -F c -f /tmp/litellm-backup.dump
"${COMPOSE[@]}" cp postgres:/tmp/litellm-backup.dump "$DIR/litellm.dump"
"${COMPOSE[@]}" exec -T postgres rm -f /tmp/litellm-backup.dump

echo "[backup] Web SQLite（短暂停 web 保证一致性，约 2-5s）..."
"${COMPOSE[@]}" stop web >/dev/null
# web_data 卷挂到 /data；容器停止后 docker cp 仍可用
WEB_CID="$("${COMPOSE[@]}" ps -aq web)"
docker cp "$WEB_CID:/data/dev.db" "$DIR/dev.db"
"${COMPOSE[@]}" start web >/dev/null

echo "[backup] 完成: $DIR"
ls -lh "$DIR"

# 滚动清理旧备份
ls -1dt "$OUT_ROOT"/20* 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  echo "[backup] 清理旧备份: $old"
  rm -rf "$old"
done