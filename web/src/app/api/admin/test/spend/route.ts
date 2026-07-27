import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
  costCny: z.number().positive(),
  daysAgo: z.number().min(0).max(30).optional().default(0),
  clearExisting: z.boolean().optional().default(false),
});

function assertTestHooksEnabled(req: Request): NextResponse | null {
  if (process.env.ALLOW_TEST_HOOKS !== "true") {
    return NextResponse.json({ error: "测试钩子未开启（ALLOW_TEST_HOOKS=true）" }, { status: 403 });
  }
  const admin = req.headers.get("x-admin-token");
  if (!admin || admin !== env().adminToken) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const denied = assertTestHooksEnabled(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  if (parsed.data.clearExisting) {
    await prisma.spendEvent.deleteMany({ where: { userId: user.id } });
  }

  const createdAt = new Date(Date.now() - parsed.data.daysAgo * 24 * 60 * 60 * 1000);
  const event = await prisma.spendEvent.create({
    data: {
      userId: user.id,
      costCny: parsed.data.costCny,
      model: "test-inject",
      createdAt,
    },
  });

  return NextResponse.json({
    ok: true,
    phone,
    eventId: event.id,
    costCny: event.costCny,
    createdAt: event.createdAt.toISOString(),
  });
}

export async function DELETE(req: Request) {
  const denied = assertTestHooksEnabled(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const phoneRaw = url.searchParams.get("phone") ?? "";
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const result = await prisma.spendEvent.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true, deleted: result.count });
}
