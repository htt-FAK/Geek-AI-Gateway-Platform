import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phone: true,
      disabled: true,
      mustChangePassword: true,
      litellmKeyTokenEnc: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => {
      let keyMode: "virtual_key" | "app_enforced" | "none" = "none";
      if (u.litellmKeyTokenEnc) {
        try {
          const token = decryptSecret(u.litellmKeyTokenEnc);
          keyMode = token.startsWith("__app_enforced__:") ? "app_enforced" : "virtual_key";
        } catch {
          keyMode = "none";
        }
      }
      return {
        phone: u.phone,
        disabled: u.disabled,
        mustChangePassword: u.mustChangePassword,
        keyMode,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    }),
  });
}
