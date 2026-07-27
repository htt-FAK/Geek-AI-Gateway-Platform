/** Client-safe public gateway base (with /v1). */
export function envPublicGateway(): string {
  const raw = (process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ?? "http://127.0.0.1:4000")
    .replace(/\/$/, "")
    .replace(/\/v1$/i, "");
  return `${raw}/v1`;
}
