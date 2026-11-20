import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { hashKey, maskApiKey } from "@/lib/keys";
import {
  GatewayDbError,
  deleteGatewayKeys,
  ensureLitellmUserAndKey,
  listGatewayKeys,
} from "@/lib/litellm";
import { withUserLock } from "@/lib/user-lock";

/**
 * 重新生成主 Key：吊销该用户**全部**网关 Key（密钥页另建的 Key 花的是同一份
 * 用户级余额，只吊销主 Key 等于没轮换），清本地副本，再签发一把新主 Key。
 * 网关密钥库不可用时绝不签发、绝不把 __app_enforced__ 哨兵写进账号
 * （chatCompletions 见到哨兵会改用 Master Key，绕过该用户的 max_budget——
 * 与删除主 Key 路径同一约束）。
 */
export async function POST() {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }

    return await withUserLock(user.id, async () => {
      // 锁内重读最新余额：签发时的预算同步不能用请求开头的快照。
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: { balanceGrantedCny: true, balanceUnlimited: true },
      });
      const grantedCny = fresh?.balanceGrantedCny ?? user.balanceGrantedCny;
      const unlimited = fresh?.balanceUnlimited ?? user.balanceUnlimited;

      let revokedAny = false;
      if (user.litellmUserId) {
        let existing;
        try {
          existing = await listGatewayKeys(user.litellmUserId);
        } catch (e) {
          // 无法确认吊销就绝不签发新 Key，否则旧 Key 还能花同一份余额
          if (e instanceof GatewayDbError) {
            return NextResponse.json(
              { error: "网关密钥库不可用：无法确认吊销旧 Key，未签发新 Key；请网关恢复后重试" },
              { status: 503 },
            );
          }
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "列出旧密钥失败；未签发新 Key" },
            { status: 502 },
          );
        }
        if (existing.length > 0) {
          try {
            await deleteGatewayKeys(existing.map((k) => k.token));
          } catch (e) {
            return NextResponse.json(
              { error: e instanceof Error ? e.message : "吊销旧密钥失败；未签发新 Key" },
              { status: 502 },
            );
          }
          await prisma.apiKeyLocal.deleteMany({ where: { userId: user.id } });
          revokedAny = true;
        }
      }

      const issued = await ensureLitellmUserAndKey(user.phone, { grantedCny, unlimited });
      if (issued.mode !== "virtual_key") {
        // 代持结果一律不落库（无论是否已吊销旧 Key）：哨兵进账号 = Master Key 代发 = 绕过预算。
        return NextResponse.json(
          {
            error: revokedAny
              ? "网关密钥库不可用：旧 Key 已吊销，新 Key 未签发；请网关恢复后重试"
              : "网关密钥库不可用：未签发 Virtual Key，也未写入占位 Key；请网关恢复后重试",
          },
          { status: 503 },
        );
      }

      const now = new Date();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          litellmUserId: issued.userId,
          litellmKeyId: issued.keyId ?? null,
          litellmKeyTokenEnc: encryptSecret(issued.key),
          keyRevealedAt: now,
        },
      });
      await prisma.apiKeyLocal.upsert({
        where: { litellmToken: hashKey(issued.key) },
        create: {
          userId: user.id,
          litellmToken: hashKey(issued.key),
          keyName: issued.keyId ?? "primary",
          keyEnc: encryptSecret(issued.key),
        },
        update: { keyEnc: encryptSecret(issued.key) },
      });

      return NextResponse.json({
        key: issued.key,
        keyMasked: maskApiKey(issued.key),
        keyMode: issued.mode,
        keyRevealedAt: now.toISOString(),
        warning: "请妥善保管密钥明文；可随时在密钥页再次查看 / 复制。",
      });
    });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "重新生成失败" },
      { status: 500 },
    );
  }
}