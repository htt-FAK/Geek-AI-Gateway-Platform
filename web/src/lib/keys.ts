/** Mask API key for list/me responses — never return full plaintext here. */
export function maskApiKey(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.startsWith("__app_enforced__:")) return "app-enforced";
  if (token.length <= 12) return `${token.slice(0, 3)}${"*".repeat(Math.max(4, token.length - 3))}`;
  const head = token.slice(0, 7);
  const tail = token.slice(-4);
  const starCount = Math.min(16, Math.max(6, token.length - head.length - tail.length));
  return `${head}${"*".repeat(starCount)}${tail}`;
}

export function isAppEnforcedKey(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith("__app_enforced__:"));
}

export type KeyMode = "virtual_key" | "app_enforced" | "none";

export function resolveKeyMode(token: string | null | undefined): KeyMode {
  if (!token) return "none";
  if (isAppEnforcedKey(token)) return "app_enforced";
  return "virtual_key";
}
