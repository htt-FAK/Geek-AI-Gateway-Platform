import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getGatewayModels } from "@/lib/gateway-models";
import { hashKey, isAppEnforcedKey } from "@/lib/keys";
import {
  GatewayDbError,
  ensureLitellmUserAndKey,
  generateGatewayKey,
  listGatewayKeys,
  syncUserBudget,
} from "@/lib/litellm";
import { withUserLock } from "@/lib/user-lock";

function gatewayUserId(phone: string): string {
  return `phone:${phone}`;
}

/** 动态模型列表里的聊天模型（排除 ASR/TTS）。 */
async function chatModelOptions(): Promise<string[]> {
  const models = await getGatewayModels();
  return models.filter((m) => !m.includes("-asr") && !m.includes("-tts"));
}

function dbDownResponse() {
  return NextResponse.json(
    { error: "网关密钥库未连接（需启动本地 Postgres 与网关 DB 模式）", dbDown: true },
    { status: 503 },
  );
}

/** 列出当前账号的全部密钥；首次访问时把 app_enforced 哨兵转正为虚拟密钥。 */
export async function GET() {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const userId = gatewayUserId(user.phone);
    try {
      // 哨兵转正 + 自愈回写都涉及「读余额 → 推网关预算」，整段与充值互斥。
      return await withUserLock(user.id, async () => {
        // 锁内重读最新余额与主 Token：请求开头的快照可能已被并发充值更新，
        // 也可能另一个密钥页请求刚完成哨兵转正——用旧快照会多签一把 Key。
        const fresh = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            balanceGrantedCny: true,
            balanceUnlimited: true,
            litellmKeyTokenEnc: true,
            litellmKeyId: true,
          },
        });
        const grantedCny = fresh?.balanceGrantedCny ?? user.balanceGrantedCny;
        const unlimited = fresh?.balanceUnlimited ?? user.balanceUnlimited;

        let keys = await listGatewayKeys(userId);
        let primaryKeyName = (fresh ?? user).litellmKeyId;
        const tokenEnc = (fresh ?? user).litellmKeyTokenEnc;
        const token = tokenEnc ? decryptSecret(tokenEnc) : null;
        // 哨兵转正不要求本地副本为空：旧副本可能指向早已吊销的 Key，留着无害
        // （列表以网关为准，reveal 先校验归属）。只要主 Token 还是哨兵就转正，
        // 否则调试台会一直走 Master Key 代发，绕过网关用户级预算硬闸。
        if (isAppEnforcedKey(token)) {
          const issued = await ensureLitellmUserAndKey(user.phone, { grantedCny, unlimited });
          if (issued.mode === "virtual_key") {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                litellmUserId: userId,
                litellmKeyTokenEnc: encryptSecret(issued.key),
                litellmKeyId: issued.keyId ?? null,
                keyRevealedAt: null,
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
              update: {},
            });
            primaryKeyName = issued.keyId ?? null;
            keys = await listGatewayKeys(userId);
          }
        }
        // 自愈对账：锁内最新余额推平到网关用户级预算（awaited，锁必须覆盖到推送完成）
        if (!isAppEnforcedKey(token)) {
          await syncUserBudget(userId, grantedCny, unlimited);
        }
        const locals = await prisma.apiKeyLocal.findMany({ where: { userId: user.id } });
        const localSet = new Set(locals.map((l) => l.litellmToken));
        return NextResponse.json({
          keys: keys.map((k) => ({
            ...k,
            isPrimary: primaryKeyName !== null && k.keyName === primaryKeyName,
            hasLocalCopy: localSet.has(k.token),
          })),
          chatModels: await chatModelOptions(),
        });
      });
    } catch (e) {
      if (e instanceof GatewayDbError) return dbDownResponse();
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}

const createSchema = z.object({
  description: z.string().max(100).optional(),
  models: z.array(z.string()).min(1),
  expiresInDays: z.number().int().positive().max(3650).nullable().optional(),
  allowedIps: z.array(z.string().min(1)).max(50).optional(),
});

/** 创建密钥：返回一次性明文，并本地加密留存以支持后续查看/复制。 */
export async function POST(req: Request) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const options = await chatModelOptions();
    const models = parsed.data.models.filter((m) => options.includes(m));
    if (models.length === 0) {
      return NextResponse.json({ error: "请至少选择一个可用模型" }, { status: 400 });
    }
    const userId = gatewayUserId(user.phone);
    try {
      const { key, keyName } = await generateGatewayKey({
        userId,
        keyAlias: parsed.data.description || undefined,
        models,
        duration: parsed.data.expiresInDays ? `${parsed.data.expiresInDays}d` : undefined,
        allowedIps: parsed.data.allowedIps,
      });
      const tokenHash = hashKey(key);
      await prisma.apiKeyLocal.upsert({
        where: { litellmToken: tokenHash },
        create: { userId: user.id, litellmToken: tokenHash, keyName, keyEnc: encryptSecret(key) },
        update: { keyEnc: encryptSecret(key), keyName },
      });
      const token = user.litellmKeyTokenEnc ? decryptSecret(user.litellmKeyTokenEnc) : null;
      if (!token || isAppEnforcedKey(token)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            litellmUserId: userId,
            litellmKeyTokenEnc: encryptSecret(key),
            litellmKeyId: keyName,
            keyRevealedAt: null,
          },
        });
      }
      return NextResponse.json({ key, keyName, token: tokenHash });
    } catch (e) {
      if (e instanceof GatewayDbError) return dbDownResponse();
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
