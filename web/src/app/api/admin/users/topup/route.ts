import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { fetchUserMaxBudget, syncUserBudget } from "@/lib/litellm";
import { normalizePhone } from "@/lib/password";
import { withUserLock } from "@/lib/user-lock";

const bodySchema = z.object({
  phone: z.string().min(1),
  /** 充值金额（正数）；与 unlimited 二选一或同时 */
  amountCny: z.number().positive().max(1_000_000).optional(),
  note: z.string().max(200).optional(),
  /** 设置/取消不限额 */
  unlimited: z.boolean().optional(),
});

/** CAS 冲突重试上限：单进程内 withUserLock 已串行，这里兜多进程边界。 */
const TOPUP_CAS_RETRIES = 5;

/**
 * 本地写入失败后的网关回滚：仅当网关 max_budget 仍等于本次写入值时才推回最新本地余额。
 * 无条件回滚会把并发新充值刚写上的预算盖回去。全程在 withUserLock 内、awaited。
 */
async function rollbackGatewayBudget(
  userId: string,
  litellmUserId: string,
  writtenGrantedCny: number,
  writtenUnlimited: boolean,
): Promise<void> {
  const gw = await fetchUserMaxBudget(litellmUserId);
  if (!gw.ok) return; // 读不到网关状态就不盲写
  const matches = writtenUnlimited
    ? gw.maxBudget === null
    : gw.maxBudget !== null && Math.abs(gw.maxBudget - writtenGrantedCny) < 1e-9;
  if (!matches) return; // 已被更新的充值覆盖，不回滚
  const latest = await prisma.user.findUnique({
    where: { id: userId },
    select: { balanceGrantedCny: true, balanceUnlimited: true },
  });
  if (!latest) return;
  const ok = await syncUserBudget(litellmUserId, latest.balanceGrantedCny, latest.balanceUnlimited);
  if (!ok) {
    console.error(`[topup] 网关预算回滚失败 user=${userId}，需自愈对账修复`);
  }
}

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
  const unlimitedOverride = parsed.data.unlimited;

  // 与自愈回写 / 密钥轮换互斥：整个「读余额 → 写网关 → 写本地」必须原子串行，
  // 否则控制台自愈会用旧快照把充值后的网关预算盖回去。
  return withUserLock(user.id, async () => {
    for (let attempt = 0; attempt < TOPUP_CAS_RETRIES; attempt += 1) {
      // 每轮（含第一轮）都在锁内重读最新余额：锁外快照可能已被并发充值/自愈更新，
      // 若第一轮用旧值写网关，进程恰在此时停机会让直连暂时用回旧上限。
      const fresh = await prisma.user.findUnique({ where: { id: user.id } });
      if (!fresh) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      const newGrantedCny = fresh.balanceGrantedCny + amount;
      const newUnlimited =
        unlimitedOverride !== undefined ? unlimitedOverride : fresh.balanceUnlimited;

      // 网关预算先写：失败则什么都不改（本地与网关同成同败），返回 503。
      // 不先改本地，避免「控制台按新余额放行、直连网关还是旧上限」的窗口。
      if (fresh.litellmUserId) {
        const gwSynced = await syncUserBudget(fresh.litellmUserId, newGrantedCny, newUnlimited);
        if (!gwSynced) {
          return NextResponse.json(
            { error: "网关预算同步失败，本次充值未生效（网关不可达或拒绝）", gwSynced: false },
            { status: 503 },
          );
        }
      }

      let written: { balanceGrantedCny: number; balanceUnlimited: boolean } | null = null;
      try {
        written = await prisma.$transaction(async (tx) => {
          // 条件更新（CAS）：where 带上读到的旧余额，并发充值不会互相覆盖。
          const upd = await tx.user.updateMany({
            where: {
              id: fresh.id,
              balanceGrantedCny: fresh.balanceGrantedCny,
              balanceUnlimited: fresh.balanceUnlimited,
            },
            data: {
              balanceGrantedCny: newGrantedCny,
              balanceUnlimited: newUnlimited,
            },
          });
          if (upd.count === 0) return null;
          if (amount > 0) {
            await tx.balanceTopUp.create({
              data: { userId: fresh.id, amountCny: amount, note: parsed.data.note ?? "" },
            });
          }
          return { balanceGrantedCny: newGrantedCny, balanceUnlimited: newUnlimited };
        });
      } catch (e) {
        // 本地写入失败：条件回滚网关预算（仍等于本次写入值才推回），保持两边一致
        if (fresh.litellmUserId) {
          await rollbackGatewayBudget(fresh.id, fresh.litellmUserId, newGrantedCny, newUnlimited);
        }
        return NextResponse.json(
          {
            error: "本地写入失败，网关预算已尝试回滚",
            detail: e instanceof Error ? e.message : "unknown",
            gwSynced: false,
          },
          { status: 503 },
        );
      }

      if (written) {
        return NextResponse.json({
          ok: true,
          phone: fresh.phone,
          balanceGrantedCny: written.balanceGrantedCny,
          balanceUnlimited: written.balanceUnlimited,
          gwSynced: Boolean(fresh.litellmUserId),
        });
      }
      // CAS 冲突 → 下一轮重读重算（网关预算也会被下一轮的新值覆盖，单调递增）
    }
    return NextResponse.json(
      { error: "充值冲突：并发写入未收敛，请重试" },
      { status: 409 },
    );
  });
}