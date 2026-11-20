import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { setUserKeysBlocked, syncUserBudget } from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";
import { withUserLock } from "@/lib/user-lock";

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
    const gwUserId = user.litellmUserId;
    // 解禁时的预算回写与充值/自愈互斥；锁内重读最新余额，不用请求开头快照。
    const result = await withUserLock(
      user.id,
      async (): Promise<{ ok: boolean; stage?: "budget" | "block" }> => {
        if (parsed.data.disabled) {
          const blocked = await setUserKeysBlocked(gwUserId, true);
          return blocked ? { ok: true } : { ok: false, stage: "block" };
        }
        const fresh = await prisma.user.findUnique({
          where: { id: user.id },
          select: { balanceGrantedCny: true, balanceUnlimited: true },
        });
        const budgetSynced = await syncUserBudget(
          gwUserId,
          fresh?.balanceGrantedCny ?? user.balanceGrantedCny,
          fresh?.balanceUnlimited ?? user.balanceUnlimited,
        );
        if (!budgetSynced) return { ok: false, stage: "budget" };
        const unblocked = await setUserKeysBlocked(gwUserId, false);
        return unblocked ? { ok: true } : { ok: false, stage: "block" };
      },
    );
    if (!result.ok) {
      const error =
        result.stage === "budget"
          ? "网关预算同步失败，本地未变更"
          : parsed.data.disabled
            ? "网关 Key 封禁失败，本地未变更"
            : "网关 Key 解封失败，本地未变更";
      return NextResponse.json({ error }, { status: 503 });
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
