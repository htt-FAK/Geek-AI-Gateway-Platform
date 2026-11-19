import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function passwordBlocked(session: { mustChangePassword: boolean }, user: { mustChangePassword: boolean }) {
  if (session.mustChangePassword || user.mustChangePassword) {
    return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    const memories = await prisma.userMemory.findMany({
      where: { userId: user.id, status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, content: true, updatedAt: true },
    });
    return NextResponse.json({
      memories: memories.map((memory) => ({
        id: memory.id,
        content: memory.content,
        updatedAt: memory.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    const url = new URL(req.url);
    if (url.searchParams.get("all") === "1") {
      await prisma.userMemory.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "deleted" },
      });
      return NextResponse.json({ ok: true });
    }
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const updated = await prisma.userMemory.updateMany({
      where: { id, userId: user.id, status: "active" },
      data: { status: "deleted" },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
