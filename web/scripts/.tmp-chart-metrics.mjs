/** Temp: dump scatter chart geometry from the live leaderboard page. */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { SignJWT } from "jose";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(webRoot, ".env") });

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const abs = url.startsWith("file:") && !path.isAbsolute(url.slice(5))
  ? `file:${path.resolve(webRoot, url.slice(5).replace(/^\.\//, ""))}`
  : url;
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: abs }) });
const user = await prisma.user.findUnique({ where: { phone: "13800138000" } });
await prisma.$disconnect();

const token = await new SignJWT({
  userId: user.id, phone: user.phone, mustChangePassword: false,
  passwordVersion: Number(user.passwordVersion ?? 0),
})
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d")
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, channel: "msedge" }); }
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
await page.addInitScript(() => {
  localStorage.setItem("aigw.appearance.v2", JSON.stringify({ skin: "minimal", theme: "light", onboarded: true }));
});
await page.context().addCookies([{ name: "gw_session", value: token, url: "http://127.0.0.1:3000", httpOnly: true, sameSite: "Lax" }]);
await page.goto("http://127.0.0.1:3000/leaderboard", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

const data = await page.evaluate(() => {
  const svg = document.querySelector(".recharts-surface");
  const box = svg?.getBoundingClientRect();
  const texts = [...document.querySelectorAll(".recharts-surface text")].map((t) => {
    const r = (t as SVGTextElement).getBBox();
    return { text: t.textContent, x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  });
  const dots = [...document.querySelectorAll(".recharts-scatter-symbol circle")].map((c) => {
    const r = (c as SVGCircleElement).getBoundingClientRect();
    return { cx: +r.x.toFixed(1), cy: +r.y.toFixed(1), r: +r.width.toFixed(1) };
  });
  const rects = [...document.querySelectorAll(".recharts-reference-area rect")].map((r) => {
    const b = (r as SVGRectElement).getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  });
  return { svg: box ? { x: box.x, y: box.y, w: box.width, h: box.height } : null, texts, dots, rects };
});
console.log(JSON.stringify(data, null, 1));
await browser.close();