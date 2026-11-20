import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

const ROUNDS = 10;

/**
 * 一次性随机初始密码（导入 / 重置密码用）：每人一把，接口返回给管理员分发，
 * 首登强制改密。不再共用 DEFAULT_USER_PASSWORD——共享默认密码意味着
 * 任何知道它的人都能在成员改密前登录其账号。
 */
export function generateInitialPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isDefaultPassword(plain: string): boolean {
  return plain === env().defaultUserPassword;
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }
  if (digits.length === 13 && digits.startsWith("86")) {
    return digits.slice(2);
  }
  return null;
}
