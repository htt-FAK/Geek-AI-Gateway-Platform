import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "gw_session";

export type SessionPayload = {
  userId: string;
  phone: string;
  mustChangePassword: boolean;
  passwordVersion: number;
};

function secretKey() {
  return new TextEncoder().encode(env().authSecret);
}

export async function createSessionToken(
  payload: SessionPayload,
  opts?: { remember?: boolean },
): Promise<string> {
  const ttl = opts?.remember ? "30d" : "7d";
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      phone: String(payload.phone),
      mustChangePassword: Boolean(payload.mustChangePassword),
      passwordVersion: Number(payload.passwordVersion ?? 0),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(
  payload: SessionPayload,
  opts?: { remember?: boolean },
): Promise<void> {
  const remember = Boolean(opts?.remember);
  const token = await createSessionToken(payload, { remember });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
