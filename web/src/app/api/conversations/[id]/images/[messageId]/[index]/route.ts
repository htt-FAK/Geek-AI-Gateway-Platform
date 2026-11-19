import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { findOwnedConversation } from "@/lib/conversation-send";
import { parseImagePaths } from "@/lib/conversation-policy";
import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/playground-files";

type Params = { params: Promise<{ id: string; messageId: string; index: string }> };

export async function GET(_req: Request, ctx: Params) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const { id, messageId, index: indexRaw } = await ctx.params;
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }
    const conversation = await findOwnedConversation(user.id, id);
    if (!conversation) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }
    const message = await prisma.message.findFirst({
      where: { id: messageId, conversationId: conversation.id },
      select: { imagePaths: true },
    });
    const rel = message ? parseImagePaths(message.imagePaths)[index] : undefined;
    if (!rel || !rel.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }
    const file = await readUpload(rel);
    if (!file) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
