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
    dailyBudgetCny: Number(process.env.DAILY_BUDGET_CNY ?? "50"),
    weeklyBudgetCny: Number(process.env.WEEKLY_BUDGET_CNY ?? "200"),
    monthlyBudgetCny: Number(process.env.MONTHLY_BUDGET_CNY ?? "400"),
    docsBaseUrl: (process.env.DOCS_BASE_URL ?? "").replace(/\/$/, ""),
    publicGatewayBaseUrl: (process.env.PUBLIC_GATEWAY_BASE_URL ?? process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:4000")
      .replace(/\/$/, "")
      .replace(/\/v1$/i, ""),
  };
}

export const GATEWAY_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "mimo-v2.5-pro",
  "mimo-v2.5-pro-ultraspeed",
  "mimo-v2.5",
  "mimo-v2.5-asr",
  "mimo-v2.5-tts",
  "mimo-v2.5-tts-voiceclone",
  "mimo-v2.5-tts-voicedesign",
] as const;
