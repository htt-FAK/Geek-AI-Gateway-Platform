#!/usr/bin/env bash
# 开机自启（当前用户登录触发，无需管理员权限）。
# 原理：Startup 文件夹放一个隐藏执行的 VBS，登录时跑 pm2 resurrect，
# 按 ~/.pm2/dump.pm2（pm2 save 的快照）恢复三件套。
# 服务器无人值守场景：需配置 Windows 自动登录，或改用 nssm 注册真服务（见 docs/运维手册.md）。
set -euo pipefail
command -v pm2 >/dev/null || { echo "缺少 pm2：npm install -g pm2" >&2; exit 1; }

startup="$APPDATA/Microsoft/Windows/Start Menu/Programs/Startup"
[ -d "$startup" ] || { echo "找不到 Startup 目录：$startup" >&2; exit 1; }

cat > "$startup/aigw-pm2-resurrect.vbs" <<'VBS'
Set ws = CreateObject("Wscript.Shell")
ws.Run "cmd /c pm2 resurrect", 0, False
VBS

pm2 save --force
echo "✔ 已写入 $startup/aigw-pm2-resurrect.vbs"
echo "  下次登录自动 pm2 resurrect；卸载：删除该 vbs 文件"