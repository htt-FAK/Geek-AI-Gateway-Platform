/**
 * 存量密钥模型列表同步：网关新增模型后，旧 Virtual Key 的 models 白名单不含新模型，
 * 用户调用会被网关拒（403 key not allowed to access model）。
 * 双保险覆盖：① /key/list 分页遍历全部 Key；② Web 库里每个用户的主 Key（解密直连更新，
 * 兜住 /key/list 分页/过滤漏掉的 Key）。新增模型后跑一次：node scripts/sync-key-models.mjs
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const GW = (process.env.GATEWAY_BASE_URL || "http://127.0.0.1:4000").replace(/\/v1$/, "");
const MASTER = process.env.LITELLM_MASTER_KEY;
if (!MASTER) { console.error("缺少 LITELLM_MASTER_KEY"); process.exit(1); }
const hdr = { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" };

const modelsRes = await fetch(`${GW}/v1/models`, { headers: hdr });
if (!modelsRes.ok) { console.error("网关不可用", modelsRes.status); process.exit(2); }
const models = ((await modelsRes.json()).data ?? []).map((m) => m.id);
console.log(`网关模型 ${models.length} 个`);

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const targets = new Map(); // tokenHash → {label, key}

// ① /key/list 分页（page_size 实测可能被忽略，按页翻到空为止）
for (let page = 1; page <= 50; page++) {
  const res = await fetch(`${GW}/key/list?return_full_object=true&page=${page}&page_size=100`, { headers: hdr });
  if (!res.ok) { console.error("key/list 失败", res.status); break; }
  const keys = (await res.json()).keys ?? [];
  for (const k of keys) {
    const isUserKey = (k.key_alias ?? "").startsWith("user-") || (k.user_id ?? "").startsWith("phone:");
    if (isUserKey && k.token) targets.set(k.token, { label: k.key_alias ?? k.token.slice(0, 12), key: null });
  }
  if (keys.length < 100) break;
}

// ② Web 库主 Key（解密拿原始 token；/key/update 接受原始 key）
function decryptSecret(sealed) {
  const b = Buffer.from(sealed, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY, "base64"), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL }) });
const users = await prisma.user.findMany({ where: { litellmKeyTokenEnc: { not: null } } });
for (const u of users) {
  try {
    const key = decryptSecret(u.litellmKeyTokenEnc);
    if (key.startsWith("__app_enforced__")) continue;
    targets.set(sha256(key), { label: `primary:${u.phone}`, key });
  } catch { /* 解密失败的跳过 */ }
}
await prisma.$disconnect();

let updated = 0, skipped = 0, failed = 0;
for (const [hash, t] of targets) {
  const body = t.key ? { key: t.key, models } : { key: hash, models };
  const res = await fetch(`${GW}/key/update`, { method: "POST", headers: hdr, body: JSON.stringify(body) });
  if (res.ok) { updated++; console.log(`UPDATED ${t.label} → ${models.length} models`); }
  else { failed++; console.error(`FAIL ${t.label}: ${res.status} ${(await res.text()).slice(0, 120)}`); }
}
console.log(`完成：更新 ${updated}，失败 ${failed}（共 ${targets.size} 把用户 Key）`);
process.exit(failed ? 1 : 0);