/**
 * Temp: sign a local session cookie (no DB writes) and screenshot /leaderboard.
 * Usage: node scripts/.tmp-leaderboard-shot.mjs <out.png>
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { SignJWT } from "jose";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const out = process.argv[2] || path.join(webRoot, ".tmp-leaderboard.png");
fs.mkdirSync(path.dirname(out), { recursive: true });

await import("dotenv/config");
process.env.DOTENV_CONFIG_PATH = path.join(webRoot, ".env");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(webRoot, ".env") });

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const abs = url.startsWith("file:") && !path.isAbsolute(url.slice(5))
  ? `file:${path.resolve(webRoot, url.slice(5).replace(/^\.\//, ""))}`
  : url;

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: abs }) });
const user = await prisma.user.findUnique({ where: { phone: process.env.TEST_PHONE || "13800138000" } });
if (!user) throw new Error("demo user missing");
await prisma.$disconnect();

const token = await new SignJWT({
  userId: user.id,
  phone: user.phone,
  mustChangePassword: false,
  passwordVersion: Number(user.passwordVersion ?? 0),
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({ headless: true, channel: "msedge" });
}
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1.25 });
await page.addInitScript(() => {
  localStorage.setItem(
    "aigw.appearance.v2",
    JSON.stringify({ skin: "minimal", theme: "light", onboarded: true }),
  );
});
await page.context().addCookies([
  { name: "gw_session", value: token, url: BASE, httpOnly: true, sameSite: "Lax" },
]);
await page.goto(`${BASE}/leaderboard`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const skip = page.getByRole("button", { name: "跳过" });
if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
const chartOut = out.replace(/\.png$/i, "-chart.png");
const chart = page.locator("section").filter({ hasText: "Intelligence Index 与每项任务的成本" }).first();
await chart.screenshot({ path: chartOut });
console.log("saved", out, chartOut, "at", page.url());
await browser.close();