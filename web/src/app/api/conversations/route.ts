import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { createConversationSchema, playgroundModelError } from "@/lib/conversation-send";
import { prisma } from "@/lib/db";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

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

    const rows = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        model: true,
        status: true,
        summary: true,
        totalTokens: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({
      conversations: rows.map((row) => ({
        id: row.id,
        title: row.title,
        model: row.model,
        status: row.status,
        totalTokens: row.totalTokens,
        updatedAt: row.updatedAt.toISOString(),
        hasSummary: row.summary.trim().length > 0,
      })),
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

const createSchema = createConversationSchema;

export async function POST(req: Request) {
  try {
    const { user, session } = await requireUser();
    const blocked = passwordBlocked(session, user);
    if (blocked) return blocked;
    if (!rateLimit(`conv-create:${user.id}`, 30, 60_000)) return tooManyRequests();

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const modelError = await playgroundModelError(parsed.data.model);
    if (modelError) {
      return NextResponse.json({ error: modelError }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        model: parsed.data.model,
        systemPrompt: parsed.data.systemPrompt ?? "",
        temperature: parsed.data.temperature ?? 0.7,
        maxTokens: parsed.data.maxTokens ?? 1024,
        stream: parsed.data.stream ?? true,
        thinkingStop: parsed.data.thinkingStop ?? null,
      },
    });
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
      },
    });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    throw error;
  }
}
