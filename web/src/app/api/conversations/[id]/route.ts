import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { findOwnedConversation } from "@/lib/conversation-send";
import { imagePublicPath, parseImagePaths } from "@/lib/conversation-policy";
import { prisma } from "@/lib/db";
import { removeConversationFiles } from "@/lib/playground-files";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

function passwordBlocked(session: { mustChangePassword: boolean }, user: { mustChangePassword: boolean }) {
  if (session.mustChangePassword || user.mustChangePassword) {
    return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
  }
  return null;
}

export async function GET(_req: Request, ctx: Params) {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    const conversation = await findOwnedConversation(user.id, id);
    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { seq: "asc" },
    });
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        systemPrompt: conversation.systemPrompt,
        temperature: conversation.temperature,
        maxTokens: conversation.maxTokens,
        stream: conversation.stream,
        thinkingStop: conversation.thinkingStop,
        status: conversation.status,
        hasSummary: conversation.summary.trim().length > 0,
        updatedAt: conversation.updatedAt.toISOString(),
      },
      lastUsage: lastAssistant
        ? {
            promptTokens: lastAssistant.promptTokens,
            completionTokens: lastAssistant.completionTokens,
            totalTokens: lastAssistant.totalTokens,
          }
        : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      messages: messages.map((message) => {
        const images = parseImagePaths(message.imagePaths);
        return {
          id: message.id,
          role: message.role,
          content: message.content,
          reasoningContent: message.reasoningContent,
          status: message.status,
          images: images.map((_, index) => imagePublicPath(conversation.id, message.id, index)),
        };
      }),
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

export async function PATCH(req: Request, ctx: Params) {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    const conversation = await findOwnedConversation(user.id, id);
    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title: parsed.data.title },
    });
    return NextResponse.json({ conversation: { id: updated.id, title: updated.title } });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    const conversation = await findOwnedConversation(user.id, id);
    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    await prisma.conversation.delete({ where: { id: conversation.id } });
    await removeConversationFiles(user.id, conversation.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
