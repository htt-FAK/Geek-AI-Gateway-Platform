function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
}

function optionalPositiveInt(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function env() {
  const rawBase = (process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  const gatewayBaseUrl = rawBase.replace(/\/v1$/i, "");
  return {
    gatewayBaseUrl,
    litellmMasterKey: requireEnv("LITELLM_MASTER_KEY"),
    defaultUserPassword: requireEnv("DEFAULT_USER_PASSWORD"),
    authSecret: requireEnv("AUTH_SECRET"),
    credentialsEncryptionKey: requireEnv("CREDENTIALS_ENCRYPTION_KEY"),
    adminToken: requireEnv("ADMIN_TOKEN"),
    /** 网关用户级 RPM 上限（覆盖该用户全部 Key 含直连）。默认 60，与 BFF 对话限流同量级。 */
    gatewayUserRpmLimit: optionalPositiveInt("GATEWAY_USER_RPM_LIMIT") ?? 60,
    /** 网关用户级 TPM 上限；不设则不写 tpm_limit。 */
    gatewayUserTpmLimit: optionalPositiveInt("GATEWAY_USER_TPM_LIMIT"),
    docsBaseUrl: (process.env.DOCS_BASE_URL ?? "").replace(/\/$/, ""),
    publicGatewayBaseUrl: (
      process.env.PUBLIC_GATEWAY_BASE_URL?.trim() ||
      process.env.GATEWAY_BASE_URL?.trim() ||
      "http://127.0.0.1:4000"
    )
      .replace(/\/+$/, "")
      .replace(/\/v1$/i, ""),
  };
}

export const GATEWAY_MODELS = [
  "deepseek-flash",
  "deepseek-v4-pro",
  "mimo-v2.6-pro",
  "mimo-v2.6-flash",
  "spark-x2.6",
  "xing4.0-29b",
  "qwen3.5-4b",
  "deepseek-ocr",
  "bge-m3",
  "bge-large-zh-v1.5",
  "bge-reranker-v2-m3",
  "mimo-v2.5-asr",
  "mimo-v2.5-tts",
  "mimo-v2.5-tts-voiceclone",
  "mimo-v2.5-tts-voicedesign",
  "qwen4-max",
  "qwen3.8-flash",
  "kimi-k3.1-pro",
  "glm-5.3-flash",
  "glm-5.3",
  "minimax-m3.1-flash",
  "sensenova-6.8-flash",
  "sensenova-6.8-flash-lite",
] as const;
