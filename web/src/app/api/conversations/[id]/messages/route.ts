import { authErrorResponse, requireUser } from "@/lib/auth";
import { sendConversationMessage } from "@/lib/conversation-send";
import { NextResponse } from "next/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    if (!rateLimit(`chat:${user.id}`, 60, 60_000)) return tooManyRequests();
    const { id } = await ctx.params;
    return await sendConversationMessage({ req, user, conversationId: id });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    throw error;
  }
}
