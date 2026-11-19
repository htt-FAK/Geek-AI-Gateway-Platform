function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}`);
  }
  return value;
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
  "step-5-preview",
] as const;
