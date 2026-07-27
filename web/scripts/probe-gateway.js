const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(path.join(__dirname, "..", ".env"));
let base = (process.env.GATEWAY_BASE_URL || "").replace(/\/$/, "").replace(/\/v1$/i, "");
const key = process.env.LITELLM_MASTER_KEY;
console.log("base", base, "keyLen", key ? key.length : 0);

(async () => {
  for (const p of ["/health", "/health/liveliness", "/key/generate", "/user/new", "/v1/models"]) {
    const isPost = p.includes("generate") || p.includes("new");
    try {
      const r = await fetch(base + p, {
        method: isPost ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: isPost
          ? JSON.stringify(
              p.includes("generate")
                ? { models: ["deepseek-v4-flash"], max_budget: 50, budget_duration: "24h" }
                : { user_id: "probe-user" },
            )
          : undefined,
      });
      const text = (await r.text()).slice(0, 200).replace(/\n/g, " ");
      console.log(p, r.status, text);
    } catch (e) {
      console.log(p, "ERR", e.message);
    }
  }
})();
