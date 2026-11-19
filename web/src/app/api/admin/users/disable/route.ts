import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { setUserKeysBlocked, syncUserBudget } from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
  disabled: z.boolean(),
});

/**
 * 禁用/解禁：先在网关上封住已经发出的 Key（/key/block、/key/unblock），
 * 成功后才改本地 disabled。解禁同时按当前余额再同步一次用户级 max_budget。
 */
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
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

  if (user.litellmUserId) {
    if (parsed.data.disabled) {
      const gwSynced = await setUserKeysBlocked(user.litellmUserId, true);
      if (!gwSynced) {
        return NextResponse.json(
          { error: "网关 Key 封禁失败，本地未变更" },
          { status: 503 },
        );
      }
    } else {
      const budgetSynced = await syncUserBudget(
        user.litellmUserId,
        user.balanceGrantedCny,
        user.balanceUnlimited,
      );
      if (!budgetSynced) {
        return NextResponse.json(
          { error: "网关预算同步失败，本地未变更" },
          { status: 503 },
        );
      }
      const unblocked = await setUserKeysBlocked(user.litellmUserId, false);
      if (!unblocked) {
        return NextResponse.json(
          { error: "网关 Key 解封失败，本地未变更" },
          { status: 503 },
        );
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { disabled: parsed.data.disabled },
  });

  return NextResponse.json({
    ok: true,
    phone: updated.phone,
    disabled: updated.disabled,
    gwSynced: Boolean(user.litellmUserId),
  });
}
