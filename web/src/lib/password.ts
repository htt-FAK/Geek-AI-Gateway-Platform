import bcrypt from "bcryptjs";
import { env } from "@/lib/env";

const ROUNDS = 10;

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
