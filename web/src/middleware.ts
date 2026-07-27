import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = new Set([
  "/",
  "/login",
  "/api/auth/login",
  "/admin/users",
  "/admin/usage",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/usage") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/api/admin") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }
  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get("gw_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const mustChange = Boolean(payload.mustChangePassword);
    if (
      mustChange &&
      pathname !== "/change-password" &&
      !pathname.startsWith("/api/auth/change-password") &&
      !pathname.startsWith("/api/auth/logout") &&
      !pathname.startsWith("/api/me")
    ) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "请先修改默认密码" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
    if (!mustChange && pathname === "/change-password") {
      return NextResponse.redirect(new URL("/playground", req.url));
    }
    if (!mustChange && (pathname === "/login" || pathname === "/")) {
      return NextResponse.redirect(new URL("/playground", req.url));
    }
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
