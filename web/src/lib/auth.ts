import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readSession, type SessionPayload } from "@/lib/session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<{ user: User; session: SessionPayload }> {
  const session = await readSession();
  if (!session) {
    throw new AuthError("未登录", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    throw new AuthError("用户不存在", 401);
  }
  if (user.disabled) {
    throw new AuthError("账号已禁用", 403);
  }
  if (session.passwordVersion !== Number(user.passwordVersion ?? 0)) {
    throw new AuthError("会话已失效，请重新登录", 401);
  }

  return { user, session };
}

export function authErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}
