/**
 * Smoke: import -> topup -> change password -> chat -> balance gate
 * Loads web/.env; does not print secrets.
 */
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(path.join(__dirname, "..", ".env"));

const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const ADMIN = process.env.ADMIN_TOKEN;
const PHONE = process.env.SMOKE_PHONE || `138${String(Date.now()).slice(-8)}`;
const NEW_PWD = "SmokePass123!";

async function req(pathname, init = {}) {
  const res = await fetch(`${BASE}${pathname}`, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json, headers: res.headers, cookies: res.headers.getSetCookie?.() ?? [] };
}

function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  console.log("1) import");
  const imp = await req("/api/admin/users/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
    body: JSON.stringify({ phones: [PHONE] }),
  });
  // 一次性初始密码只在本次响应里，不打印明文
  const initialPwd = (imp.json.initialPasswords ?? []).find((p) => p.phone === PHONE)?.password;
  console.log(imp.status, JSON.stringify({ created: imp.json.created, skipped: imp.json.skipped, errors: imp.json.errors }));
  if (!initialPwd) throw new Error("import did not return initialPassword");

  console.log("1b) topup ¥10 (balance system: new accounts start at ¥0)");
  const topup = await req("/api/admin/users/topup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
    body: JSON.stringify({ phone: PHONE, amountCny: 10, note: "smoke" }),
  });
  console.log(topup.status, JSON.stringify(topup.json));
  if (!topup.json.ok) throw new Error("topup failed");

  console.log("2) login with one-time initial password");
  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: PHONE, password: initialPwd }),
  });
  console.log(login.status, JSON.stringify(login.json));
  if (!login.json.requirePasswordChange) throw new Error("expected requirePasswordChange");
  let cookie = cookieHeader(login.cookies);

  console.log("3) change password");
  const ch = await req("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ oldPassword: initialPwd, newPassword: NEW_PWD }),
  });
  console.log(ch.status, JSON.stringify(ch.json));
  if (ch.cookies.length) cookie = cookieHeader(ch.cookies);

  console.log("3b) create first key (new accounts start keyless)");
  const ck = await req("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ models: ["deepseek-flash"], description: "smoke" }),
  });
  console.log(ck.status, ck.json.keyName ?? ck.json.error);
  if (!ck.json.key) throw new Error("key creation failed");

  console.log("4) chat non-stream");
  const chat = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      model: "deepseek-flash",
      stream: false,
      max_tokens: 16,
      messages: [{ role: "user", content: "回复一个字：好" }],
    }),
  });
  console.log(chat.status, chat.json.error || chat.json.choices?.[0]?.message?.content?.slice(0, 80) || JSON.stringify(chat.json).slice(0, 200));

  console.log("5) me balance");
  const me = await req("/api/me", { headers: { Cookie: cookie } });
  console.log(me.status, JSON.stringify(me.json.balance), me.json.keyMode);

  console.log("6) balance gate (zero out granted)");
  const { PrismaLibSql } = require("@prisma/adapter-libsql");
  const { PrismaClient } = require("@prisma/client");
  const dbUrl = `file:${path.resolve(__dirname, "..", "dev.db")}`;
  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });
  const user = await prisma.user.findUnique({ where: { phone: PHONE } });
  if (!user) throw new Error("user missing");
  await prisma.user.update({
    where: { id: user.id },
    data: { balanceGrantedCny: 0 },
  });
  const blocked = await req("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      model: "deepseek-flash",
      stream: false,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  console.log(blocked.status, JSON.stringify(blocked.json));
  if (blocked.status !== 402 || !String(blocked.json.error || "").includes("余额不足")) {
    throw new Error("expected 402 balance gate");
  }
  await prisma["$disconnect"]();
  console.log("SMOKE_OK");
}

main().catch((e) => {
  console.error("SMOKE_FAIL", e.message);
  process.exit(1);
});
