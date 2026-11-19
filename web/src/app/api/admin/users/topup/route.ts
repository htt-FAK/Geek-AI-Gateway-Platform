import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { syncUserBudget } from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";

const bodySchema = z.object({
  phone: z.string().min(1),
  /** 充值金额（正数）；与 unlimited 二选一或同时 */
  amountCny: z.number().positive().max(1_000_000).optional(),
  note: z.string().max(200).optional(),
  /** 设置/取消不限额 */
  unlimited: z.boolean().optional(),
});

/** 管理员充值 / 不限额开关：本地流水 + 网关用户级预算同步。 */
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  if (parsed.data.amountCny === undefined && parsed.data.unlimited === undefined) {
    return NextResponse.json({ error: "请提供充值金额或不限额开关" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "手机号格式无效" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const amount = parsed.data.amountCny ?? 0;
  const newGrantedCny = user.balanceGrantedCny + amount;
  const newUnlimited =
    parsed.data.unlimited !== undefined ? parsed.data.unlimited : user.balanceUnlimited;

  // 网关预算先写：失败则什么都不改（本地与网关同成同败），返回 503。
  // 不先改本地，避免「控制台按新余额放行、直连网关还是旧上限」的窗口。
  if (user.litellmUserId) {
    const gwSynced = await syncUserBudget(user.litellmUserId, newGrantedCny, newUnlimited);
    if (!gwSynced) {
      return NextResponse.json(
        { error: "网关预算同步失败，本次充值未生效（网关不可达或拒绝）", gwSynced: false },
        { status: 503 },
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          balanceGrantedCny: newGrantedCny,
          balanceUnlimited: newUnlimited,
        },
      });
      if (amount > 0) {
        await tx.balanceTopUp.create({
          data: { userId: user.id, amountCny: amount, note: parsed.data.note ?? "" },
        });
      }
      return u;
    });

    return NextResponse.json({
      ok: true,
      phone: updated.phone,
      balanceGrantedCny: updated.balanceGrantedCny,
      balanceUnlimited: updated.balanceUnlimited,
      gwSynced: Boolean(user.litellmUserId),
    });
  } catch (e) {
    // 本地写入失败：把网关预算回滚到旧值，保持两边一致
    if (user.litellmUserId) {
      void syncUserBudget(user.litellmUserId, user.balanceGrantedCny, user.balanceUnlimited);
    }
    return NextResponse.json(
      {
        error: "本地写入失败，已回滚网关预算",
        detail: e instanceof Error ? e.message : "unknown",
        gwSynced: false,
      },
      { status: 503 },
    );
  }
}
