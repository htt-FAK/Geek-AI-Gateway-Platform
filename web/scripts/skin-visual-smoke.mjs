/**
 * Visual smoke: login → apply skins → screenshot playground.
 * Run: node scripts/skin-visual-smoke.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", ".tmp-skin-shots");
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const PHONE = process.env.TEST_PHONE || "13800138000";
const PASS = process.env.TEST_PASSWORD || "ChangeMe123";

const SKINS = ["minimal", "trae", "golden", "google", "doubao", "claude", "apple", "21th"];
const MODES = ["dark", "light"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const report = [];

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  await page.fill('input[name="phone"], input[type="tel"], input[placeholder*="手机"], input', PHONE);
  // Prefer password field
  const pass = page.locator('input[type="password"]');
  await pass.fill(PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(playground|change-password|dashboard)/, { timeout: 30000 });

  if (page.url().includes("change-password")) {
    report.push("WARN: landed on change-password — skin chrome still testable after skip if possible");
  }

  // Dismiss style onboarding if present
  const skip = page.getByRole("button", { name: "跳过" });
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(400);
  }

  // Ensure playground
  if (!page.url().includes("/playground")) {
    await page.goto(`${BASE}/playground`, { waitUntil: "networkidle" });
  }
  // Dismiss onboarding again if shell remounted
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
  }

  for (const skin of SKINS) {
    for (const theme of MODES) {
      await page.evaluate(
        ({ skin, theme }) => {
          localStorage.setItem(
            "aigw.appearance.v2",
            JSON.stringify({ skin, theme, onboarded: true }),
          );
          const r = document.documentElement;
          r.dataset.skin = skin;
          r.dataset.theme = theme;
          r.classList.toggle("dark", theme === "dark");
          r.classList.toggle("light", theme === "light");
        },
        { skin, theme },
      );
      await page.waitForTimeout(250);
      const metrics = await page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        return {
          bg: cs.getPropertyValue("--bg-base").trim(),
          accent: cs.getPropertyValue("--accent-primary").trim(),
          fontUi: cs.getPropertyValue("--font-ui").trim().slice(0, 80),
          bodyFont: body.fontFamily.slice(0, 80),
          skin: document.documentElement.dataset.skin,
          theme: document.documentElement.dataset.theme,
        };
      });
      const file = `${skin}-${theme}.png`;
      await page.screenshot({ path: path.join(outDir, file), fullPage: false });
      report.push({ file, ...metrics });
      console.log(JSON.stringify({ file, ...metrics }));
    }
  }

  // Entry should stay brand-fixed even if skin=trae light
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem(
      "aigw.appearance.v2",
      JSON.stringify({ skin: "trae", theme: "light", onboarded: true }),
    );
    const r = document.documentElement;
    r.dataset.skin = "trae";
    r.dataset.theme = "light";
    r.classList.add("light");
    r.classList.remove("dark");
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const entry = await page.evaluate(() => {
    const shell = document.querySelector(".entry-shell");
    if (!shell) return { ok: false, reason: "no entry-shell" };
    const cs = getComputedStyle(shell);
    return {
      ok: true,
      bg: cs.getPropertyValue("--bg-base").trim() || cs.backgroundColor,
      color: cs.color,
    };
  });
  await page.screenshot({ path: path.join(outDir, "entry-with-trae-light.png") });
  report.push({ file: "entry-with-trae-light.png", entry });
  console.log(JSON.stringify({ entryCheck: entry }));

  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log("OUT_DIR=" + outDir);
} catch (e) {
  console.error("FAIL", e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
