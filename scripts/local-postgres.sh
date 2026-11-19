#!/usr/bin/env bash
# 本地 PostgreSQL（LiteLLM 密钥库）管理脚本 —— 免安装 zip 二进制方案。
# 用法: ./scripts/local-postgres.sh {start|stop|status|init}
# 二进制默认在 C:/Users/Public/aigw-pgsql（Windows 中文路径会导致 initdb 失败，
# 故放在纯英文路径）；可用 PGROOT 环境变量覆盖。
set -euo pipefail

PGROOT="${PGROOT:-C:/Users/Public/aigw-pgsql}"
PGDATA="$PGROOT/data"
PGLOG="$PGROOT/pg.log"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-litellm}"
PGDB="${PGDB:-litellm}"

bin() { echo "$PGROOT/bin/$1"; }

case "${1:-status}" in
  init)
    if [ -d "$PGDATA" ]; then
      echo "数据目录已存在：$PGDATA"
      exit 0
    fi
    "$(bin initdb.exe)" -D "$PGDATA" -U "$PGUSER" -A trust -E UTF8 --locale=C
    "$(bin pg_ctl.exe)" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -c listen_addresses=127.0.0.1" start
    sleep 2
    "$(bin createdb.exe)" -h 127.0.0.1 -p "$PGPORT" -U "$PGUSER" "$PGDB" || true
    echo "初始化完成：postgresql://$PGUSER@127.0.0.1:$PGPORT/$PGDB"
    ;;
  start)
    "$(bin pg_ctl.exe)" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -c listen_addresses=127.0.0.1" start
    ;;
  stop)
    "$(bin pg_ctl.exe)" -D "$PGDATA" stop
    ;;
  status)
    "$(bin pg_ctl.exe)" -D "$PGDATA" status
    ;;
  *)
    echo "用法: $0 {start|stop|status|init}" >&2
    exit 1
    ;;
esac
