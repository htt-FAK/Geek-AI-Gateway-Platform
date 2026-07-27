import { NextResponse } from "next/server";

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now >= cur.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) {
    return false;
  }
  cur.count += 1;
  return true;
}

export function tooManyRequests() {
  return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
}
