/**
 * PM2 进程守护配置（Linux 裸机部署，scripts/setup-linux.sh 生成环境后使用）。
 * Postgres 由 systemd 原生管理（apt 安装即自启），PM2 只守护网关 + Web。
 * 用法：pm2 start deploy/pm2/ecosystem.linux.cjs && pm2 save && pm2 startup systemd
 */
const path = require("path");
const fs = require("fs");

const REPO = path.resolve(__dirname, "..", "..");
const WEB = path.join(REPO, "web");
const GATEWAY = path.join(REPO, "gateway");
const LOGS = path.join(REPO, "logs");
const VENV_PY = path.join(REPO, ".venv", "bin", "python");
const NODE = process.execPath;

// 与 Windows 版同理：显式注入 gateway/.env，避免进程继承的环境变量覆盖（.env 为唯一事实来源）
function readEnvFile(p) {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}
const GATEWAY_ENV = readEnvFile(path.join(GATEWAY, ".env"));

const common = {
  autorestart: true,
  restart_delay: 2000,
  max_restarts: 50,
  min_uptime: "5s",
  kill_timeout: 8000,
  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    {
      name: "aigw-gateway",
      ...common,
      script: VENV_PY,
      args: ["-m", "litellm.proxy.proxy_cli", "--config", "./config.yaml", "--port", "4000", "--host", "127.0.0.1"],
      interpreter: "none",
      cwd: GATEWAY,
      out_file: path.join(LOGS, "pm2-gateway.log"),
      error_file: path.join(LOGS, "pm2-gateway.log"),
      env: {
        ...GATEWAY_ENV,
        PYTHONUNBUFFERED: "1",
        LITELLM_LOCAL_MODEL_COST_MAP: "True",
        PRISMA_HEALTH_WATCHDOG_PROBE_TIMEOUT_SECONDS: "15",
        PRISMA_HEALTH_WATCHDOG_INTERVAL_SECONDS: "60",
      },
    },
    {
      name: "aigw-web",
      ...common,
      script: NODE,
      args: [path.join(WEB, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", "3000"],
      interpreter: "none",
      cwd: WEB,
      out_file: path.join(LOGS, "pm2-web.log"),
      error_file: path.join(LOGS, "pm2-web.log"),
      env: { NODE_ENV: "production" },
    },
  ],
};