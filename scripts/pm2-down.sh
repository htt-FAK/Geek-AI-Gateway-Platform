#!/usr/bin/env bash
# 停止并移除 PM2 纳管（不删日志）。注意：若装过开机自启（pm2-boot-install.sh），
# 下次登录时 pm2 resurrect 仍会按最后一次 pm2 save 的清单拉起；
# 想彻底停用请先删除 Startup 里的 aigw-pm2-resurrect.vbs。
set -euo pipefail
pm2 delete aigw-web aigw-gateway aigw-postgres || true
pm2 status || true