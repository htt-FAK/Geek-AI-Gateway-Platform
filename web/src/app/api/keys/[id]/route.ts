import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { CHAT_MODEL_IDS } from "@/lib/model-market";
import {
  GatewayDbError,
  deleteGatewayKeys,
  listGatewayKeys,
  updateGatewayKey,
} from "@/lib/litellm";

type Params = { params: Promise<{ id: string }> };

function dbDownResponse() {
  return NextResponse.json(
    { error: "网关密钥库未连接（需启动本地 Postgres 与网关 DB 模式）", dbDown: true },
    { status: 503 },
  );
}

class OwnershipError extends Error {
  constructor() {
    super("密钥不存在或不属于当前账号");
    this.name = "OwnershipError";
  }
}

function handleError(e: unknown): NextResponse | null {
  if (e instanceof GatewayDbError) return dbDownResponse();
  if (e instanceof OwnershipError) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
  return null;
}

/** 校验归属（id = LiteLLM 哈希 token），返回本地明文（可能为空）。 */
async function ownedKey(
  userId: string,
  litellmToken: string,
): Promise<{ fullKey: string | null }> {
  const keys = await listGatewayKeys(userId);
  if (!keys.some((k) => k.token === litellmToken)) {
    throw new OwnershipError();
  }
  const local = await prisma.apiKeyLocal.findUnique({ where: { litellmToken } });
  return { fullKey: local ? decryptSecret(local.keyEnc) : null };
}

const patchSchema = z.object({
  description: z.string().max(100).optional(),
  models: z.array(z.string()).min(1).optional(),
  expiresInDays: z.number().int().positive().max(3650).nullable().optional(),
});

/** 更新密钥：描述 / 模型 / 有效期 / IP 白名单 / 预算。 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const { id } = await params;
    const litellmToken = decodeURIComponent(id);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    try {
      const { fullKey } = await ownedKey(`phone:${user.phone}`, litellmToken);
      if (!fullKey) {
        return NextResponse.json(
          { error: "该密钥创建时未在本平台留存明文，无法编辑（可在网关侧直接管理）" },
          { status: 400 },
        );
      }
      const models = parsed.data.models?.filter((m) => (CHAT_MODEL_IDS as string[]).includes(m));
      if (parsed.data.models && (!models || models.length === 0)) {
        return NextResponse.json({ error: "请至少选择一个可用模型" }, { status: 400 });
      }
      await updateGatewayKey(fullKey, {
        keyAlias: parsed.data.description,
        models,
        duration:
          parsed.data.expiresInDays === undefined
            ? undefined
            : parsed.data.expiresInDays === null
              ? null // LiteLLM v1.83：显式 null 的 duration → expires=None（永久）
              : `${parsed.data.expiresInDays}d`,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const res = handleError(e);
      if (res) return res;
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}

/** 删除密钥；若删的是主密钥，自动改指下一把活跃密钥。 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const { id } = await params;
    const litellmToken = decodeURIComponent(id);
    try {
      const userId = `phone:${user.phone}`;
      const { fullKey } = await ownedKey(userId, litellmToken);
      await deleteGatewayKeys([fullKey ?? litellmToken]);
      await prisma.apiKeyLocal.deleteMany({ where: { litellmToken, userId: user.id } });
      if (user.litellmKeyId !== null) {
        const remaining = await listGatewayKeys(userId);
        const wasPrimary = !remaining.some((k) => k.keyName === user.litellmKeyId);
        if (wasPrimary) {
          const next = remaining.find((k) => !k.blocked);
          const nextLocal = next
            ? await prisma.apiKeyLocal.findUnique({ where: { litellmToken: next.token } })
            : null;
          if (next && nextLocal) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                litellmKeyTokenEnc: nextLocal.keyEnc,
                litellmKeyId: next.keyName,
                keyRevealedAt: null,
              },
            });
          } else {
            // 没有可切换的下一把本地副本：清空主 Key。
            // 绝不能写 __app_enforced__ 哨兵——chatCompletions 会改用 Master Key 代发，
            // 而 Master Key 不受该用户 max_budget 约束。没有 Key 时 /api/chat 返回 400。
            await prisma.user.update({
              where: { id: user.id },
              data: {
                litellmKeyTokenEnc: null,
                litellmKeyId: null,
                keyRevealedAt: null,
              },
            });
          }
        }
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      const res = handleError(e);
      if (res) return res;
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
