import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { GatewayDbError, listGatewayKeys } from "@/lib/litellm";

type Params = { params: Promise<{ id: string }> };

/** 查看完整密钥：读取创建时本地加密留存的明文（仅限本人密钥）。 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { user, session } = await requireUser();
    if (session.mustChangePassword || user.mustChangePassword) {
      return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
    }
    const { id } = await params;
    const litellmToken = decodeURIComponent(id);
    try {
      const keys = await listGatewayKeys(`phone:${user.phone}`);
      if (!keys.some((k) => k.token === litellmToken)) {
        return NextResponse.json({ error: "密钥不存在或不属于当前账号" }, { status: 404 });
      }
      const local = await prisma.apiKeyLocal.findUnique({ where: { litellmToken } });
      if (!local) {
        return NextResponse.json(
          { error: "该密钥创建时未在本平台留存明文，无法再次查看" },
          { status: 400 },
        );
      }
      return NextResponse.json({ key: decryptSecret(local.keyEnc) });
    } catch (e) {
      if (e instanceof GatewayDbError) {
        return NextResponse.json(
          { error: "网关密钥库未连接（需启动本地 Postgres 与网关 DB 模式）", dbDown: true },
          { status: 503 },
        );
      }
      throw e;
    }
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
