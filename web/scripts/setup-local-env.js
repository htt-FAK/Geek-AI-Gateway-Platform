// One-off local dev setup: generates web/.env and gateway/.env with random secrets.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const webRoot = path.resolve(__dirname, "..");
const dbAbs = "file:" + path.join(webRoot, "dev.db").split(path.sep).join("/");
const authSecret = crypto.randomBytes(48).toString("base64url");
const encKey = crypto.randomBytes(32).toString("base64");
const masterKey = "sk-geek-local-" + crypto.randomBytes(16).toString("hex");
// 安全口径：默认密码与 ADMIN_TOKEN 一律强随机，禁止弱口令入库（首登强制改密）
const defaultPassword = crypto.randomBytes(18).toString("base64url");
const adminToken = "adm-" + crypto.randomBytes(24).toString("base64url");

const webEnv = `# App DB (sqlite local)
DATABASE_URL="${dbAbs}"

# Gateway
GATEWAY_BASE_URL=http://127.0.0.1:4000
LITELLM_MASTER_KEY=${masterKey}

# Auth
DEFAULT_USER_PASSWORD=${defaultPassword}
AUTH_SECRET=${authSecret}
CREDENTIALS_ENCRYPTION_KEY=${encKey}
ADMIN_TOKEN=${adminToken}

# 余额模型：不再有日/周/月限额环境变量；新用户余额 0，需管理员充值
ALLOW_TEST_HOOKS=true
`;

fs.writeFileSync(path.join(webRoot, ".env"), webEnv);
fs.writeFileSync(
  path.join(webRoot, "..", "gateway", ".env"),
  `DEEPSEEK_API_KEY=sk-placeholder\nMIMO_API_KEY=sk-placeholder\nLITELLM_MASTER_KEY=${masterKey}\n`,
);
console.log("web/.env 和 gateway/.env 已生成");
console.log("DATABASE_URL=" + dbAbs);
