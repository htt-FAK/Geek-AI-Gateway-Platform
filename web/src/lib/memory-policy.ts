import { createHash } from "crypto";

/** 长期记忆条数与正文字数上限。超出时丢掉最旧的条目。 */
export const MAX_MEMORIES = 40;
export const MAX_MEMORY_CHARS = 1_500;
/** 单条事实上限。抽取提示要求 80 字，这里留一点余量。 */
export const MAX_MEMORY_FACT_CHARS = 200;

export const MEMORY_MODEL = "deepseek-flash";

export type MemoryOp =
  | { op: "add"; content: string }
  | { op: "update"; match: string; content: string }
  | { op: "drop"; match: string };

export type MemoryItem = {
  id: string;
  content: string;
  hash: string;
  createdAt: number;
  /** 读取时的 updatedAt（毫秒），用于写入前做并发 CAS。 */
  updatedAt?: number;
};

export function normalizeMemory(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

export function memoryHash(content: string): string {
  return createHash("sha256").update(normalizeMemory(content)).digest("hex");
}

/** 拒绝密钥、密码、验证码，以及长过一条事实的文本。 */
export function isRejectedMemory(content: string): boolean {
  const text = normalizeMemory(content);
  if (!text || text.length > MAX_MEMORY_FACT_CHARS) return true;
  if (/密码|密钥|验证码|口令/.test(text)) return true;
  if (/sk-[A-Za-z0-9_-]{6,}/i.test(text)) return true;
  if (/api[_-]?key/i.test(text)) return true;
  if (/\b(password|passwd|secret|token)\b/i.test(text)) return true;
  if (/bearer\s+[A-Za-z0-9\-._~+/]{8,}/i.test(text)) return true;
  return false;
}

export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{6,}/gi, "[已省略密钥]")
    .replace(/bearer\s+[A-Za-z0-9\-._~+/]{8,}/gi, "[已省略密钥]")
    // 密码/口令/密钥类：抹掉关键词后紧跟的值（允许“是/为/：/= ”分隔）。
    // 值必须是 ASCII 串，避免把“用户忘记了密码，后来重置”整句删掉。
    .replace(
      /(密码|口令|密钥|pass(?:word|wd)?|pwd|secret|token|api[_-]?key)\s*(?:是|为|[:：=])?\s*[A-Za-z0-9!@#$%^&*._+\-]{3,64}/gi,
      "$1：[已省略]",
    )
    // 验证码/动态码：关键词后 4-8 位数字
    .replace(/(验证码|校验码|动态码)\s*(?:是|为|[:：=])?\s*\d{4,8}/g, "$1：[已省略]");
}

export function parseMemoryOps(raw: string): MemoryOp[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const ops = (parsed as { ops?: unknown }).ops;
  if (!Array.isArray(ops)) return [];
  const out: MemoryOp[] = [];
  for (const item of ops) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const content = typeof rec.content === "string" ? rec.content : "";
    const match = typeof rec.match === "string" ? rec.match : "";
    if (rec.op === "add" && content.trim()) {
      out.push({ op: "add", content });
    } else if (rec.op === "update" && content.trim() && match.trim()) {
      out.push({ op: "update", match, content });
    } else if (rec.op === "drop" && match.trim()) {
      out.push({ op: "drop", match });
    }
  }
  return out;
}

function matches(item: MemoryItem, match: string): boolean {
  const needle = match.trim();
  if (!needle) return false;
  return item.hash === needle || item.content.includes(needle);
}

function capMemories(items: MemoryItem[]): MemoryItem[] {
  const next = [...items].sort((a, b) => a.createdAt - b.createdAt || a.hash.localeCompare(b.hash));
  const chars = () => next.reduce((sum, item) => sum + item.content.length, 0);
  while (next.length > MAX_MEMORIES || (next.length > 0 && chars() > MAX_MEMORY_CHARS)) {
    next.shift();
  }
  return next;
}

/**
 * 把模型给出的 add/update/drop 应用到现有记忆上。
 * 新条目 id 为空，调用方据此插入；被拒绝的密钥类事实直接丢掉。
 */
export function applyMemoryOps(
  existing: readonly MemoryItem[],
  ops: readonly MemoryOp[],
  now: number,
): MemoryItem[] {
  const items = existing.map((item) => ({ ...item }));
  let stamp = now;
  for (const op of ops) {
    if (op.op === "drop") {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (matches(items[i], op.match)) items.splice(i, 1);
      }
      continue;
    }
    if (isRejectedMemory(op.content)) continue;
    const content = normalizeMemory(op.content);
    const hash = memoryHash(content);
    if (op.op === "update") {
      const target = items.find((item) => matches(item, op.match));
      if (target) {
        if (items.some((item) => item !== target && item.hash === hash)) {
          const index = items.indexOf(target);
          if (index >= 0) items.splice(index, 1);
        } else {
          target.content = content;
          target.hash = hash;
        }
        continue;
      }
    }
    if (items.some((item) => item.hash === hash)) continue;
    stamp += 1;
    items.push({ id: "", content, hash, createdAt: stamp });
  }
  return capMemories(items);
}
