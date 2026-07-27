#!/usr/bin/env node
/**
 * 服务器端全面验收（纯 HTTP，不依赖本机 Prisma/SQLite）
 *
 * 用法（在服务器上，服务已 docker / npm 拉起后）:
 *   export WEB_BASE_URL=http://127.0.0.1:3000
 *   export GATEWAY_BASE_URL=http://127.0.0.1:4000
 *   export LITELLM_MASTER_KEY=...
 *   export ADMIN_TOKEN=...
 *   export DEFAULT_USER_PASSWORD=...
 *   export ALLOW_TEST_HOOKS=true   # web 进程也要开，才能测周限额注入
 *   export REQUIRE_VIRTUAL_KEY=true  # Docker+Postgres 部署后应设 true
 *   node web/scripts/server-e2e.mjs
 *
 * 或从 web 目录: npm run test:server
 * 会自动尝试加载 web/.env 与 gateway/.env（不覆盖已有环境变量）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", "..", "gateway", ".env"));

const WEB = (process.env.WEB_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const GW = (process.env.GATEWAY_BASE_URL || "http://127.0.0.1:4000").replace(/\/$/, "").replace(/\/v1$/i, "");
const MASTER = process.env.LITELLM_MASTER_KEY;
const ADMIN = process.env.ADMIN_TOKEN;
const DEFAULT_PWD = process.env.DEFAULT_USER_PASSWORD;
const MODEL = process.env.TEST_MODEL || "deepseek-v4-flash";
const REQUIRE_VK = process.env.REQUIRE_VIRTUAL_KEY === "true";
const SKIP_LLM = process.env.SKIP_LIVE_LLM === "true";
const PHONE = process.env.TEST_PHONE || `138${String(Date.now()).slice(-8)}`;
const NEW_PWD = process.env.TEST_NEW_PASSWORD || "ServerE2E_Pass_123!";

const results = [];

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, pass: false, detail });
  console.log(`  FAIL  ${name} — ${detail}`);
}

function assert(name, cond, detail) {
  if (cond) ok(name, typeof detail === "string" ? detail : "");
  else fail(name, detail || "assertion failed");
}

async function http(base, pathname, init = {}) {
  const res = await fetch(`${base}${pathname}`, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, setCookie, headers: res.headers };
}

function cookieJar(setCookies, prev = "") {
  const map = new Map();
  for (const part of prev.split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const c of setCookies) {
    const first = c.split(";")[0];
    const i = first.indexOf("=");
    if (i <= 0) continue;
    const name = first.slice(0, i);
    const value = first.slice(i + 1);
    const expired = /Max-Age=0/i.test(c) || /Expires=.*1970/i.test(c) || value === "";
    if (expired) map.delete(name);
    else map.set(name, value);
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  console.log("=== Geek LLM Gateway 服务器验收 ===");
  console.log(`WEB=${WEB}`);
  console.log(`GW=${GW}`);
  console.log(`PHONE=${PHONE}`);
  console.log(`REQUIRE_VIRTUAL_KEY=${REQUIRE_VK} SKIP_LIVE_LLM=${SKIP_LLM}`);
  console.log("");

  if (!MASTER || !ADMIN || !DEFAULT_PWD) {
    console.error("缺少 LITELLM_MASTER_KEY / ADMIN_TOKEN / DEFAULT_USER_PASSWORD");
    process.exit(2);
  }

  // ---------- A. Gateway ----------
  console.log("[A] Gateway 就绪");
  {
    const live = await http(GW, "/health/liveliness");
    assert("gateway liveliness", live.status === 200, `status=${live.status}`);

    const models = await http(GW, "/v1/models", {
      headers: { Authorization: `Bearer ${MASTER}` },
    });
    const ids = Array.isArray(models.json?.data) ? models.json.data.map((m) => m.id) : [];
    assert("gateway /v1/models", models.status === 200 && ids.includes(MODEL), `models=${ids.slice(0, 5).join(",")}`);

    const userId = `phone:e2e-${PHONE}`;
    const userRes = await http(GW, "/user/new", {
      method: "POST",
      headers: { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const userOk =
      userRes.status < 500 &&
      !String(userRes.text).includes("DB not connected");
    assert(
      "gateway /user/new (DB)",
      userOk || !REQUIRE_VK,
      `status=${userRes.status} body=${String(userRes.text).slice(0, 120)}`,
    );

    const keyRes = await http(GW, "/key/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        key_alias: `e2e-${PHONE}`,
        models: [MODEL],
        max_budget: 50,
        budget_duration: "24h",
      }),
    });
    const key = keyRes.json?.key || keyRes.json?.token;
    const vkOk = keyRes.status === 200 && Boolean(key);
    assert(
      "gateway /key/generate Virtual Key",
      vkOk || !REQUIRE_VK,
      `status=${keyRes.status} ${String(keyRes.text).slice(0, 120)}`,
    );

    if (vkOk && !SKIP_LLM) {
      const tiny = await http(GW, "/key/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${MASTER}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: `phone:e2e-daily-${PHONE}`,
          key_alias: `e2e-daily-${PHONE}`,
          models: [MODEL],
          max_budget: 0.000001,
          budget_duration: "24h",
        }),
      });
      const tinyKey = tiny.json?.key || tiny.json?.token;
      if (tiny.status === 200 && tinyKey) {
        const blocked = await http(GW, "/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${tinyKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 8,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        assert(
          "gateway 日限额硬拦截（极低 max_budget）",
          blocked.status === 400 || blocked.status === 402 || blocked.status === 429 || blocked.status >= 500,
          `status=${blocked.status} ${String(blocked.text).slice(0, 160)}`,
        );
      } else {
        fail("gateway 日限额硬拦截（极低 max_budget）", `无法发卡 status=${tiny.status}`);
      }
    } else if (!vkOk) {
      ok("gateway 日限额硬拦截（跳过）", "无 Virtual Key / DB，跳过");
    }
  }

  // ---------- B. 管理导入 ----------
  console.log("\n[B] 管理端导入");
  let cookie = "";
  {
    const bad = await http(WEB, "/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": "wrong-token" },
      body: JSON.stringify({ phones: [PHONE] }),
    });
    assert("admin 错误 token → 401", bad.status === 401, `status=${bad.status}`);

    const imp = await http(WEB, "/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phones: [PHONE, "not-a-phone"] }),
    });
    assert("admin import 200", imp.status === 200, `status=${imp.status}`);
    assert("admin import 创建用户", Array.isArray(imp.json.created) && imp.json.created.includes(PHONE), JSON.stringify(imp.json));
    assert(
      "admin import 无效号进 errors",
      Array.isArray(imp.json.errors) && imp.json.errors.length >= 1,
      JSON.stringify(imp.json.errors),
    );

    const again = await http(WEB, "/api/admin/users/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phones: [PHONE] }),
    });
    assert(
      "admin 重复导入 skipped",
      again.status === 200 && Array.isArray(again.json.skipped) && again.json.skipped.includes(PHONE),
      JSON.stringify(again.json),
    );
  }

  // ---------- C. 登录 / 强制改密 ----------
  console.log("\n[C] 登录与强制改密");
  {
    const wrong = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: "wrong-password-xxx" }),
    });
    assert("错误密码 → 401", wrong.status === 401, `status=${wrong.status}`);

    const login = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: DEFAULT_PWD }),
    });
    assert("默认密码登录成功", login.status === 200 && login.json.ok === true, JSON.stringify(login.json));
    assert("requirePasswordChange=true", login.json.requirePasswordChange === true, JSON.stringify(login.json));
    cookie = cookieJar(login.setCookie);

    const blockedChat = await http(WEB, "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [{ role: "user", content: "should block" }],
      }),
    });
    assert("未改密禁止对话", blockedChat.status === 403, `status=${blockedChat.status}`);

    const rejectDefault = await http(WEB, "/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ oldPassword: DEFAULT_PWD, newPassword: DEFAULT_PWD }),
    });
    assert("禁止新密码=默认密码", rejectDefault.status === 400, `status=${rejectDefault.status}`);

    const oldCookie = cookie;
    const ch = await http(WEB, "/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ oldPassword: DEFAULT_PWD, newPassword: NEW_PWD }),
    });
    assert("改密成功", ch.status === 200 && ch.json.ok === true, JSON.stringify(ch.json));
    cookie = cookieJar(ch.setCookie, cookie);

    const revoked = await http(WEB, "/api/me", { headers: { Cookie: oldCookie } });
    assert("改密后旧 cookie → 401", revoked.status === 401, `status=${revoked.status} ${JSON.stringify(revoked.json)}`);

    const login2 = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: NEW_PWD }),
    });
    assert("新密码可登录", login2.status === 200 && login2.json.requirePasswordChange === false, JSON.stringify(login2.json));
    cookie = cookieJar(login2.setCookie);
  }

  // ---------- D. /me + Key 模式 ----------
  console.log("\n[D] 会话与 Key 模式");
  {
    const me = await http(WEB, "/api/me", { headers: { Cookie: cookie } });
    assert("/api/me 200", me.status === 200, `status=${me.status}`);
    assert("budget 字段齐全", me.json.budget?.dailyLimit > 0 && me.json.budget?.weeklyLimit > 0, JSON.stringify(me.json.budget));
    assert("models 非空", Array.isArray(me.json.models) && me.json.models.includes(MODEL), String(me.json.models?.length));
    if (REQUIRE_VK) {
      assert("keyMode=virtual_key", me.json.keyMode === "virtual_key", `keyMode=${me.json.keyMode}`);
    } else {
      ok("keyMode", `keyMode=${me.json.keyMode}`);
    }
  }

  // ---------- E. 对话 ----------
  console.log("\n[E] Playground 对话代理");
  if (SKIP_LLM) {
    ok("跳过真实 LLM 调用", "SKIP_LIVE_LLM=true");
  } else {
    const chat = await http(WEB, "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        max_tokens: 16,
        messages: [{ role: "user", content: "只回复一个字：好" }],
      }),
    });
    assert(
      "非流式对话",
      chat.status === 200 &&
        (Boolean(chat.json.choices?.[0]?.message?.content) ||
          Boolean(chat.json.choices?.[0]?.message) ||
          chat.json.object === "chat.completion"),
      `status=${chat.status} ${String(chat.text).slice(0, 180)}`,
    );

    const stream = await http(WEB, "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: 16,
        messages: [{ role: "user", content: "只回复一个字：好" }],
      }),
    });
    assert(
      "流式对话",
      stream.status === 200 && (stream.text.includes("data:") || stream.text.includes("choices")),
      `status=${stream.status} ${stream.text.slice(0, 120)}`,
    );

    const me2 = await http(WEB, "/api/me", { headers: { Cookie: cookie } });
    ok("对话后额度展示", `dailyUsed=${me2.json.budget?.dailyUsed} weeklyUsed=${me2.json.budget?.weeklyUsed}`);
  }

  // ---------- F. 周限额（测试钩子） ----------
  console.log("\n[F] 周限额闸门");
  {
    const inject = await http(WEB, "/api/admin/test/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phone: PHONE, costCny: 200, daysAgo: 3, clearExisting: true }),
    });
    if (inject.status === 403) {
      fail("周限额注入", "web 未开启 ALLOW_TEST_HOOKS=true，无法测周限额");
    } else {
      assert("注入近 7 日 spend=200", inject.status === 200 && inject.json.ok === true, JSON.stringify(inject.json));
      const blocked = await http(WEB, "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      assert(
        "周限额 → 402",
        blocked.status === 402 && String(blocked.json.error || "").includes("周限额"),
        `status=${blocked.status} ${JSON.stringify(blocked.json)}`,
      );

      const cleared = await http(WEB, `/api/admin/test/spend?phone=${PHONE}`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN },
      });
      assert("清理测试 spend", cleared.status === 200, JSON.stringify(cleared.json));
    }
  }

  // ---------- G. 管理闭环 ----------
  console.log("\n[G] 管理闭环：列表/禁用/重置/重发卡");
  {
    const list = await http(WEB, "/api/admin/users", {
      headers: { "x-admin-token": ADMIN },
    });
    const listed = Array.isArray(list.json?.users) ? list.json.users : [];
    assert("admin users 列表 200", list.status === 200 && listed.length >= 0, `status=${list.status} ${String(list.text).slice(0, 160)}`);
    assert(
      "admin users 含导入手机号",
      listed.some((u) => u.phone === PHONE),
      JSON.stringify(listed.map((u) => u.phone)),
    );

    const disable = await http(WEB, "/api/admin/users/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phone: PHONE, disabled: true }),
    });
    assert("禁用用户", disable.status === 200 && disable.json.disabled === true, JSON.stringify(disable.json));

    const loginDisabled = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: NEW_PWD }),
    });
    assert("禁用后登录 → 403", loginDisabled.status === 403, `status=${loginDisabled.status}`);

    const enable = await http(WEB, "/api/admin/users/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phone: PHONE, disabled: false }),
    });
    assert("启用用户", enable.status === 200 && enable.json.disabled === false, JSON.stringify(enable.json));

    const loginEnabled = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: NEW_PWD }),
    });
    assert("启用后可登录", loginEnabled.status === 200, `status=${loginEnabled.status}`);
    cookie = cookieJar(loginEnabled.setCookie);

    const reset = await http(WEB, "/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phone: PHONE }),
    });
    assert("重置密码", reset.status === 200 && reset.json.mustChangePassword === true, JSON.stringify(reset.json));

    const stale = await http(WEB, "/api/me", { headers: { Cookie: cookie } });
    assert("重置密码后旧会话 → 401", stale.status === 401, `status=${stale.status}`);

    const loginDefault = await http(WEB, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: PHONE, password: DEFAULT_PWD }),
    });
    assert(
      "重置后默认密码可登且需改密",
      loginDefault.status === 200 && loginDefault.json.requirePasswordChange === true,
      JSON.stringify(loginDefault.json),
    );
    cookie = cookieJar(loginDefault.setCookie);

    const reissue = await http(WEB, "/api/admin/users/reissue-key", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN },
      body: JSON.stringify({ phone: PHONE }),
    });
    assert(
      "重发卡",
      reissue.status === 200 &&
        (reissue.json.keyMode === "virtual_key" || reissue.json.keyMode === "app_enforced"),
      JSON.stringify(reissue.json),
    );

    // finish forced password change so later logout path stays clean
    const ch2 = await http(WEB, "/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ oldPassword: DEFAULT_PWD, newPassword: NEW_PWD }),
    });
    assert("管理闭环后再次改密", ch2.status === 200, JSON.stringify(ch2.json));
    cookie = cookieJar(ch2.setCookie, cookie);
  }

  // ---------- H. 登出 ----------
  console.log("\n[H] 登出");
  {
    const out = await http(WEB, "/api/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert("logout 200", out.status === 200, `status=${out.status}`);
    cookie = cookieJar(out.setCookie, cookie);
    const me = await http(WEB, "/api/me", { headers: cookie ? { Cookie: cookie } : {} });
    assert("登出后 /api/me 401", me.status === 401, `status=${me.status} cookie=${cookie || "(empty)"}`);
  }

  // ---------- Summary ----------
  const failed = results.filter((r) => !r.pass);
  console.log("\n=== 汇总 ===");
  console.log(`通过 ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log("失败项:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("SERVER_E2E_OK");
}

main().catch((e) => {
  console.error("SERVER_E2E_FAIL", e);
  process.exit(1);
});
