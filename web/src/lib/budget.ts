import { prisma } from "@/lib/db";
import { fetchUserSpend } from "@/lib/litellm";

/** 本地 SpendEvent 全量合计（网关离线 / 应用代持时的回退口径）。 */
export async function getAppSpendTotal(userId: string): Promise<number> {
  const agg = await prisma.spendEvent.aggregate({
    where: { userId },
    _sum: { costCny: true },
  });
  return agg._sum.costCny ?? 0;
}

export type BalanceInfo = {
  unlimited: boolean;
  grantedCny: number;
  spendCny: number;
  /** 不限额时为 null（无上限） */
  balanceCny: number | null;
};

/**
 * 余额 = 累计充值 − 累计花费。
 * 花费优先取网关用户级 spend（覆盖控制台 + Virtual Key 直连两条路径）；
 * 网关离线或应用代持时回退本地 SpendEvent 合计。
 */
export async function getBalance(params: {
  userId: string;
  litellmUserId: string | null;
  litellmKeyToken: string | null;
}): Promise<BalanceInfo> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { balanceGrantedCny: true, balanceUnlimited: true },
  });
  const grantedCny = user?.balanceGrantedCny ?? 0;
  const unlimited = user?.balanceUnlimited ?? false;

  let spendCny = 0;
  const isAppEnforced =
    !params.litellmKeyToken || params.litellmKeyToken.startsWith("__app_enforced__:");
  if (!isAppEnforced && params.litellmUserId) {
    const gwSpend = await fetchUserSpend(params.litellmUserId);
    spendCny = gwSpend ?? (await getAppSpendTotal(params.userId));
  } else {
    spendCny = await getAppSpendTotal(params.userId);
  }

  return {
    unlimited,
    grantedCny,
    spendCny,
    balanceCny: unlimited ? null : Math.max(0, grantedCny - spendCny),
  };
}

/** 余额门：不限额账户直接放行；余额耗尽抛 BudgetError（路由侧转 402）。 */
export async function assertHasBalance(params: {
  userId: string;
  litellmUserId: string | null;
  litellmKeyToken: string | null;
}): Promise<void> {
  const balance = await getBalance(params);
  if (!balance.unlimited && (balance.balanceCny ?? 0) <= 0) {
    throw new BudgetError("余额不足，请联系管理员充值");
  }
}

export class BudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetError";
  }
}
