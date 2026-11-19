/**
 * PM2 进程守护配置（Windows 本机部署）。
 *
 * 三个进程：本地 Postgres（LiteLLM 密钥库）→ LiteLLM 网关 :4000 → Web 控制台 :3000（生产 build+start）。
 * 启动顺序由 scripts/pm2-up.sh 保证（Postgres 就绪后再起网关）。
 *
 * 用法（Git Bash，仓库根目录）：
 *   ./scripts/pm2-up.sh          # 首次启动 / 重建纳管
 *   pm2 status | pm2 logs        # 查看状态 / 日志
 *   pm2 restart aigw-gateway     # 重启单个进程
 *   ./scripts/pm2-down.sh        # 停止并移除纳管
 *
 * 日志落盘：logs/pm2-*.log（PM2 自身还会在 ~/.pm2/logs/ 留一份）。
 * kill 任一进程后 PM2 会在数秒内自动拉起（restart_delay=2000）。
 */
const path = require("path");
const fs = require("fs");

const REPO = path.resolve(__dirname, "..", "..");
const WEB = path.join(REPO, "web");
const GATEWAY = path.join(REPO, "gateway");
const LOGS = path.join(REPO, "logs");
const PGROOT = process.env.PGROOT || "C:/Users/Public/aigw-pgsql";
const NODE = process.execPath;
// 与当前 shell 的 python 保持一致（litellm 装在 D:/PythonUser/Python310/site-packages，
// 由解释器侧 .pth 引入，勿换成其他 Python）
const PYTHON = process.env.AIGW_PYTHON || "python";

// 强制以 gateway/.env 为准注入环境变量：litellm 的 load_dotenv() 不覆盖已存在的
// 进程环境变量，若系统/用户环境里有同名旧值（实测踩过 DASHSCOPE_API_KEY 旧值），
// 网关会拿错 Key。这里显式注入，.env 成为唯一事实来源。
function readEnvFile(p) {
  const out = {};
  try {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* 文件缺失时退回 litellm 自加载 */ }
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
  // 必须隐藏控制台窗口：Windows 上默认可见，用户关掉弹窗会向进程发 CTRL_C，
  // 造成「关窗 → 进程退出 → PM2 重启 → 再弹窗」的风暴（2026-11-19 实测踩坑）
  windowsHide: true,
};

module.exports = {
  apps: [
    {
      name: "aigw-postgres",
      ...common,
      // 直接守护 postgres.exe 本体（不能用 pg_ctl：它派生子进程后自身退出，PM2 会误判）
      script: path.join(PGROOT, "bin", "postgres.exe"),
      args: ["-D", path.join(PGROOT, "data"), "-p", "5432", "-c", "listen_addresses=127.0.0.1"],
      interpreter: "none",
      cwd: PGROOT,
      out_file: path.join(LOGS, "pm2-postgres.log"),
      error_file: path.join(LOGS, "pm2-postgres.log"),
      // Postgres 拒绝以管理员身份运行；PM2 守护进程以当前普通用户运行即可
    },
    {
      name: "aigw-gateway",
      ...common,
      script: PYTHON,
      args: ["-m", "litellm.proxy.proxy_cli", "--config", "./config.yaml", "--port", "4000"],
      interpreter: "none",
      cwd: GATEWAY,
      out_file: path.join(LOGS, "pm2-gateway.log"),
      error_file: path.join(LOGS, "pm2-gateway.log"),
      // gateway/.env 显式注入（见 readEnvFile 注释）＋运行时调优：
      // LITELLM_LOCAL_MODEL_COST_MAP：跳过启动期远程价目表拉取（国内必断连，白等超时）
      // 看门狗探针放宽：默认 5s 探针超时偶发误判 → 无谓重建引擎（每次重建有数秒 DB 空窗）
      env: {
        ...GATEWAY_ENV,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
        LITELLM_LOCAL_MODEL_COST_MAP: "True",
        PRISMA_HEALTH_WATCHDOG_PROBE_TIMEOUT_SECONDS: "15",
        PRISMA_HEALTH_WATCHDOG_INTERVAL_SECONDS: "60",
      },
    },
    {
      name: "aigw-web",
      ...common,
      // 生产模式：先 npm run build，再 next start（Next 自行加载 web/.env）
      script: NODE,
      args: [path.join(WEB, "node_modules", "next", "dist", "bin", "next"), "start", "-p", "3000"],
      interpreter: "none",
      cwd: WEB,
      out_file: path.join(LOGS, "pm2-web.log"),
      error_file: path.join(LOGS, "pm2-web.log"),
      env: { NODE_ENV: "production" },
    },
  ],
};