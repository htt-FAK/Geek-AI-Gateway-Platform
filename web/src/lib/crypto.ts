import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/lib/env";

function keyBytes(): Buffer {
  const raw = Buffer.from(env().credentialsEncryptionKey, "base64");
  if (raw.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be base64 of 32 bytes");
  }
  return raw;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
