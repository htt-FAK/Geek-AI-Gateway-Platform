import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, isDefaultPassword, verifyPassword } from "@/lib/password";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

const bodySchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    if (isDefaultPassword(parsed.data.newPassword)) {
      return NextResponse.json({ error: "新密码不能与默认密码相同" }, { status: 400 });
    }
    if (parsed.data.newPassword === parsed.data.oldPassword) {
      return NextResponse.json({ error: "新密码不能与旧密码相同" }, { status: 400 });
    }

    if (!(await verifyPassword(parsed.data.oldPassword, user.passwordHash))) {
      return NextResponse.json({ error: "旧密码错误" }, { status: 401 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordVersion: { increment: 1 },
      },
    });

    await clearSessionCookie();
    await setSessionCookie({
      userId: updated.id,
      phone: updated.phone,
      mustChangePassword: false,
      passwordVersion: updated.passwordVersion,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authRes = authErrorResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
