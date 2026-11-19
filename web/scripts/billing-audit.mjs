/**
 * 商业级计费审计套件。运行：node scripts/billing-audit.mjs
 * 覆盖：峰时规则单测 / 四模型流式与非流式记账精度 / 密钥归属 / 失败路径不记账 /
 *       缓存计价 / 网关-本地对账 / 密钥级预算硬闸 / 余额门 402 / 限流 429。
 * 会创建临时测试账号与探针密钥，结束后清理。真实调用约 10 次（费用 < ¥0.05）。
 */
import "dotenv/config";
import assert from "node:assert";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { applyDeepSeekPeak, isPeakShanghai } from "../src/lib/peak-pricing.ts";

const BASE = "http://localhost:3000";
const GW = process.env.GATEWAY_BASE_URL || "http://127.0.0.1:4000";
const MASTER = process.env.LITELLM_MASTER_KEY;
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL }) });

const PRICES = {
  "deepseek-flash": [1, 4],
  "deepseek-v4-pro": [4.5, 13.5],
  "mimo-v2.6-pro": [3, 6],
  "mimo-v2.6-flash": [1, 2],
};
// 缓存命中输入价（¥/M，与 gateway/config.yaml 的 cache_read_input_token_cost 一致）
const CACHE_PRICES = {
  "deepseek-flash": 0.02,
  "deepseek-v4-pro": 0.15,
  "mimo-v2.6-pro": 0.025,
  "mimo-v2.6-flash": 0.02,
};

// 从调用结果取上游 usage（流式解析 SSE 末块）——用于缓存折扣口径
function usageOf(r) {
  if (r.json?.usage) return r.json.usage;
  let usage = null;
  for (const line of (r.text || "").split("\n")) {
    if (!line.startsWith("data:")) continue;
    const p = line.slice(5).trim();
    if (p === "[DONE]") continue;
    try { const j = JSON.parse(p); if (j.usage) usage = j.usage; } catch {}
  }
  return usage;
}

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`PASS ${name}${extra ? " | " + extra : ""}`); }
  else { fail++; console.log(`FAIL ${name}${extra ? " | " + extra : ""}`); }
}

async function login(phone, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  assert(res.ok, `login ${phone} failed`);
  return cookie;
}

// 取最后一个非空 gw_session（change-password 会先清后设，产生两条 Set-Cookie）
function sessionCookie(res) {
  const list = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") || ""];
  const last = list.filter((c) => /^gw_session=[^;]/.test(c)).pop();
  return (last || "").split(";")[0];
}

// 首登强制改密：默认密码登录 → 业务 API 应 403 → 改密 → 放行。
// 返回改密后的新会话 cookie（passwordVersion 已递增，旧 cookie 失效）。
async function loginWithForcedChange(phone, defaultPassword) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password: defaultPassword }),
  });
  assert(res.ok, `login ${phone} failed`);
  const body = await res.json();
  let cookie = sessionCookie(res);
  if (!body.requirePasswordChange) return cookie;
  const probe = await fetch(`${BASE}/api/keys`, { headers: { Cookie: cookie } });
  assert(probe.status === 403, `改密前业务 API 应 403，实际 ${probe.status}`);
  const newPassword = `${defaultPassword}#Audit1`;
  const ch = await fetch(`${BASE}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ oldPassword: defaultPassword, newPassword }),
  });
  assert(ch.ok, `首登改密失败 HTTP ${ch.status}: ${await ch.text()}`);
  cookie = sessionCookie(ch);
  console.log("  演示账号首登强制改密流程已验证（审计结束恢复初始态）");
  return cookie;
}

async function chat(cookie, body, { abortAfterFirstChunk = false } = {}) {
  const ac = new AbortController();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
    signal: ac.signal,
  });
  if (!res.ok) return { status: res.status, json: await res.json().catch(() => null), text: "" };
  if (!body.stream) return { status: res.status, json: await res.json(), text: "" };
  // 流式：读全文（或首块后中止）
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      if (abortAfterFirstChunk && text.includes("data:")) {
        ac.abort();
        break;
      }
    }
  } catch { /* aborted */ }
  return { status: res.status, json: null, text };
}

const eventCount = (userId) => prisma.spendEvent.count({ where: { userId } });
const latestEvent = (userId) =>
  prisma.spendEvent.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });

// ---------- 1. 峰时规则单测（与网关 Python 侧同规则） ----------
console.log("=== 1. 峰时规则 ===");
const at = (s) => new Date(s);
check("工作日峰时 ×2", applyDeepSeekPeak(0.01, "deepseek-flash", at("2026-11-19T10:00:00+08:00")) === 0.02);
check("工作日 13 点错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2026-11-19T13:00:00+08:00")) === 0.01);
check("周六峰时窗口仍错峰", applyDeepSeekPeak(0.01, "deepseek-v4-pro", at("2026-11-21T10:00:00+08:00")) === 0.01);
check("国庆节假日错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2026-10-01T10:00:00+08:00")) === 0.01);
check("春节节假日错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2026-02-17T15:00:00+08:00")) === 0.01);
check("09:00 边界算峰时", isPeakShanghai(at("2026-11-19T09:00:00+08:00")) === true);
check("12:00 边界算错峰", isPeakShanghai(at("2026-11-19T12:00:00+08:00")) === false);
check("MiMo 不受峰时影响", applyDeepSeekPeak(0.01, "mimo-v2.6-pro", at("2026-11-19T10:00:00+08:00")) === 0.01);
check("零费用不放大", applyDeepSeekPeak(0, "deepseek-flash", at("2026-11-19T10:00:00+08:00")) === 0);
// 2027 年表（国办发明电〔2026〕10号）：与网关 Python 侧同步
check("2027 春节除夕错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2027-02-05T10:00:00+08:00")) === 0.01);
check("2027 端午单日错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2027-06-09T10:00:00+08:00")) === 0.01);
check("2027 补班周六仍错峰", applyDeepSeekPeak(0.01, "deepseek-flash", at("2027-05-08T10:00:00+08:00")) === 0.01);
check("2027 普通工作日峰时 ×2", applyDeepSeekPeak(0.01, "deepseek-flash", at("2027-02-15T10:00:00+08:00")) === 0.02);

// ---------- 准备 ----------
for (let i = 0; i < 30; i++) {
  try { const r = await fetch(`${BASE}/login`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}
try {
  const g = await fetch(`${GW}/health/liveliness`);
  if (!g.ok) throw new Error(`HTTP ${g.status}`);
} catch (e) {
  console.error(`网关不可用（${GW}）：${e.message}。先启动网关再跑审计。`);
  process.exit(2);
}
const DEFAULT_PWD = process.env.DEFAULT_USER_PASSWORD || "ChangeMe123";
// 审计自带幂等重置：无论上次运行是否中途崩溃，都从「默认密码 + 首登强制改密」初始态开始
await prisma.user.update({
  where: { phone: "13800138000" },
  data: {
    passwordHash: await bcrypt.hash(DEFAULT_PWD, 10),
    mustChangePassword: true,
    passwordVersion: { increment: 1 },
  },
});
const demoCookie = await loginWithForcedChange("13800138000", DEFAULT_PWD);
const demo = await prisma.user.findUnique({ where: { phone: "13800138000" } });

// ---------- 2. 四模型 × 流式/非流式 记账精度 + 密钥归属 ----------
console.log("=== 2. 记账精度（当前%s）===", isPeakShanghai() ? "峰时" : "错峰");
for (const model of Object.keys(PRICES)) {
  for (const stream of [false, true]) {
    const before = await eventCount(demo.id);
    const r = await chat(demoCookie, {
      model,
      messages: [{ role: "user", content: `审计${Date.now()}：回复 ok` }],
      stream,
      max_tokens: 40,
    });
    if (r.status !== 200) { check(`${model} stream=${stream} 调用`, false, `HTTP ${r.status}`); continue; }
    const after = await eventCount(demo.id);
    const ev = await latestEvent(demo.id);
    const [pi, po] = PRICES[model];
    const pc = CACHE_PRICES[model];
    // 缓存命中部分按缓存价计费（MiMo ±8% 口径差已定位为此折扣，见 probe-mimo-billing.mjs）：
    // 期望值 = (输入-缓存)×输入价 + 缓存×缓存价 + 输出×输出价，与网关引擎同口径
    const cached = usageOf(r)?.prompt_tokens_details?.cached_tokens ?? 0;
    const expected = applyDeepSeekPeak(((ev.promptTokens - cached) * pi + cached * pc + ev.completionTokens * po) / 1e6, model);
    const tol = 2e-6; // 引擎精确计费，四模型统一严格容差
    const ok = after === before + 1 && ev.model === model && Math.abs(ev.costCny - expected) < tol && ev.totalTokens > 0;
    check(`${model} stream=${stream}`, ok, `记 ¥${ev.costCny.toFixed(6)} 期望 ¥${expected.toFixed(6)} tokens ${ev.promptTokens}/${ev.completionTokens} cached=${cached}`);
    check(`${model} stream=${stream} 密钥归属`, ev.keyName === demo.litellmKeyId, ev.keyName);
  }
}

// ---------- 3. 失败路径不记账 ----------
console.log("=== 3. 失败路径 ===");
{
  const before = await eventCount(demo.id);
  const r1 = await chat(demoCookie, { model: "no-such-model", messages: [{ role: "user", content: "x" }], stream: false });
  const r2 = await chat(demoCookie, { model: "deepseek-flash", messages: "bad", stream: false });
  const after = await eventCount(demo.id);
  check("非法模型 400", r1.status === 400);
  check("非法请求体 400", r2.status === 400);
  check("失败不记账", after === before);
}

// ---------- 4. 缓存计价（软断言：命中则费用应下降） ----------
console.log("=== 4. 缓存计价 ===");
{
  const longPrompt = "审计缓存探针。" + "网关计费一致性验证文本。".repeat(60) + "只回复 ok";
  const r1 = await chat(demoCookie, { model: "deepseek-flash", messages: [{ role: "user", content: longPrompt }], stream: false, max_tokens: 20 });
  const e1 = await latestEvent(demo.id);
  const r2 = await chat(demoCookie, { model: "deepseek-flash", messages: [{ role: "user", content: longPrompt }], stream: false, max_tokens: 20 });
  const e2 = await latestEvent(demo.id);
  const u1 = r1.json?.usage ?? {};
  const u2 = r2.json?.usage ?? {};
  const cached = u2.prompt_tokens_details?.cached_tokens ?? 0;
  // 只比输入侧成本（completion 含随机思考 token，总费用不可比）：命中部分按缓存价 0.02/M
  const in1 = ((u1.prompt_tokens ?? 0) * 1) / 1e6;
  const in2 = (((u2.prompt_tokens ?? 0) - cached) * 1 + cached * 0.02) / 1e6;
  console.log(`  缓存命中 tokens=${cached}，输入侧成本 ¥${in1.toFixed(6)} → ¥${in2.toFixed(6)}`);
  if (cached === 0) {
    check("缓存探针（上游本次未命中，不保证；跳过）", true);
  } else {
    check("缓存命中时输入侧成本下降", in2 < in1);
  }
}

// ---------- 5. 网关-本地对账 ----------
console.log("=== 5. 对账 ===");
{
  const res = await fetch(`${GW}/user/info?user_id=${encodeURIComponent(demo.litellmUserId)}`, {
    headers: { Authorization: `Bearer ${MASTER}` },
  });
  const info = (await res.json())?.user_info ?? {};
  const gwSpend = Number(info.spend ?? 0);
  const local = (await prisma.spendEvent.aggregate({ where: { userId: demo.id }, _sum: { costCny: true } }))._sum.costCny ?? 0;
  console.log(`  网关用户级 spend ¥${gwSpend.toFixed(6)} | 本地 SpendEvent ¥${local.toFixed(6)} | 差 ¥${(gwSpend - local).toFixed(6)}（直连调用/历史口径差）`);
  check("两侧均有消费记录", gwSpend > 0 && local > 0);
}

// ---------- 6. 用户级预算硬闸（直连网关绕过 BFF 也管得住；预算统一在用户级） ----------
console.log("=== 6. 用户级预算硬闸 ===");
{
  const keysRes = await fetch(`${BASE}/api/keys`, { headers: { Cookie: demoCookie } });
  const primary = (await keysRes.json()).keys.find((k) => k.isPrimary);
  const revealRes = await fetch(`${BASE}/api/keys/${encodeURIComponent(primary.token)}/reveal`, {
    method: "POST",
    headers: { Cookie: demoCookie },
  });
  const { key } = await revealRes.json();
  const setBudget = (b) => fetch(`${GW}/user/update`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: demo.litellmUserId, max_budget: b }),
  });
  // 把用户预算压到远低于已发生 spend → 下一笔直连应立即被拒
  await setBudget(0.00005);
  const blocked = await fetch(`${GW}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "user", content: "reply ok" }], max_tokens: 20 }),
  });
  const body = await blocked.text();
  check("超预算直连被网关拒绝", blocked.status === 429 && /budget|exceed/i.test(body), `HTTP ${blocked.status}`);
  await setBudget(null); // 恢复不限额
  const restored = await fetch(`${GW}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "user", content: "reply ok" }], max_tokens: 20 }),
  });
  check("恢复额度后直连放行", restored.ok, `HTTP ${restored.status}`);
}

// ---------- 7. 余额门 402 ----------
console.log("=== 7. 余额门 ===");
const TEST_PHONE = "13900001111";
{
  await prisma.user.deleteMany({ where: { phone: TEST_PHONE } });
  await prisma.user.create({
    data: {
      phone: TEST_PHONE,
      passwordHash: await bcrypt.hash("AuditTest123!", 10),
      mustChangePassword: false,
      balanceGrantedCny: 0.00005,
      balanceUnlimited: false,
      litellmUserId: `phone:${TEST_PHONE}`,
      litellmKeyTokenEnc: null,
    },
  });
  // 无密钥 → 给 app_enforced 哨兵（本地口径）；加密算法与 src/lib/crypto.ts 一致
  const crypto = await import("node:crypto");
  const encKey = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
  const plain = `__app_enforced__:phone:${TEST_PHONE}`;
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const sealed = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
  await prisma.user.update({
    where: { phone: TEST_PHONE },
    data: { litellmKeyTokenEnc: sealed },
  });
  const c = await login(TEST_PHONE, "AuditTest123!");
  const r1 = await chat(c, { model: "deepseek-flash", messages: [{ role: "user", content: "reply ok" }], stream: false, max_tokens: 30 });
  const r2 = await chat(c, { model: "deepseek-flash", messages: [{ role: "user", content: "reply ok again" }], stream: false, max_tokens: 30 });
  check("余额内首笔放行", r1.status === 200, `HTTP ${r1.status}`);
  check("余额耗尽 402", r2.status === 402, `HTTP ${r2.status} ${r2.json?.error ?? ""}`);

  // ---------- 8. 限流 429 ----------
  console.log("=== 8. 限流 ===");
  let got429 = false;
  for (let i = 0; i < 65; i++) {
    const r = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: c },
      body: "{}",
    });
    if (r.status === 429) { got429 = true; break; }
  }
  check("60 次/分钟后 429", got429);
  await prisma.user.deleteMany({ where: { phone: TEST_PHONE } });
}

// ---------- 9. 流式中止不崩溃 ----------
console.log("=== 9. 流式中止 ===");
{
  const r = await chat(demoCookie, { model: "mimo-v2.6-flash", messages: [{ role: "user", content: "数到一百" }], stream: true, max_tokens: 200 }, { abortAfterFirstChunk: true });
  const probe = await chat(demoCookie, { model: "deepseek-flash", messages: [{ role: "user", content: "reply ok" }], stream: false, max_tokens: 20 });
  check("中止后服务仍正常", probe.status === 200, `中止请求 status=${r.status}`);
}

// ---------- 收尾：演示账号恢复初始态（默认密码 + 首登强制改密） ----------
// 保证验收口径「演示账号首登强制改密」始终成立，且审计可重复运行
await prisma.user.update({
  where: { phone: "13800138000" },
  data: {
    passwordHash: await bcrypt.hash(DEFAULT_PWD, 10),
    mustChangePassword: true,
    passwordVersion: { increment: 1 },
  },
});

console.log(`\n===== 审计结果：${pass} PASS / ${fail} FAIL =====`);
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
