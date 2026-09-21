import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { reissueVirtualKey } from "@/lib/key-lifecycle";
import { maskApiKey } from "@/lib/keys";

export async function POST() {
  try {
    const { user } = await requireUser({ requirePasswordChanged: true });
    const { issued, updated, revealedAt } = await reissueVirtualKey(user);

    if (issued.mode === "app_enforced") {
      return NextResponse.json(
        {
          error: "网关未签发 Virtual Key（应用代持模式），无法提供外部 SDK 密钥",
          keyMode: issued.mode,
          keyMasked: maskApiKey(issued.key),
          keyRevealedAt: updated.keyRevealedAt,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      key: issued.key,
      keyMasked: maskApiKey(issued.key),
      keyMode: issued.mode,
      keyRevealedAt: revealedAt?.toISOString() ?? null,
      warning: "请立即复制完整密钥。关闭后无法再看明文；丢失请重新生成。",
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
