import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
  disabled: z.boolean(),
});

export async function POST(req: Request) {
  const denied = requireAdmin(req);
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { disabled: parsed.data.disabled },
  });

  return NextResponse.json({
    ok: true,
    phone: updated.phone,
    disabled: updated.disabled,
  });
}
