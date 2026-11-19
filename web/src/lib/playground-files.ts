import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * 图片落盘目录。默认在项目 cwd 下（本机开发）；
 * 容器里 cwd 是镜像层 /app，必须用 PLAYGROUND_UPLOAD_ROOT 指到挂载卷（/data），
 * 否则重建容器后图片全丢、会话里的图片链接全部 404。
 */
export function playgroundUploadRoot(): string {
  const configured = process.env.PLAYGROUND_UPLOAD_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), "data", "playground-uploads");
}

/** 相对路径必须落在上传根目录里。`..` 和绝对路径直接拒绝。 */
export function resolveUploadPath(root: string, rel: string): string | null {
  if (!rel || rel.includes("\0")) return null;
  const normalized = rel.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  const absRoot = path.resolve(root);
  const abs = path.resolve(absRoot, ...segments);
  const relToRoot = path.relative(absRoot, abs);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) return null;
  return abs;
}

export function parseImageDataUrl(url: string): { mime: string; ext: string; bytes: Buffer } | null {
  const matched = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url.trim());
  if (!matched) return null;
  const mime = matched[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return null;
  return { mime, ext, bytes: Buffer.from(matched[2], "base64") };
}

export async function saveMessageImages(input: {
  userId: string;
  conversationId: string;
  messageId: string;
  dataUrls: readonly string[];
}): Promise<string[]> {
  const root = playgroundUploadRoot();
  const rels: string[] = [];
  for (let index = 0; index < input.dataUrls.length; index += 1) {
    const parsed = parseImageDataUrl(input.dataUrls[index]);
    if (!parsed) {
      throw new Error("图片数据无效");
    }
    const rel = [input.userId, input.conversationId, input.messageId, `${index}.${parsed.ext}`].join("/");
    const abs = resolveUploadPath(root, rel);
    if (!abs) throw new Error("图片路径无效");
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, parsed.bytes);
    rels.push(rel);
  }
  return rels;
}

export async function readUpload(rel: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const abs = resolveUploadPath(playgroundUploadRoot(), rel);
  if (!abs) return null;
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime) return null;
  try {
    const bytes = await readFile(abs);
    return { bytes, mime };
  } catch {
    return null;
  }
}

export async function removeConversationFiles(userId: string, conversationId: string): Promise<void> {
  const rel = `${userId}/${conversationId}`;
  const abs = resolveUploadPath(playgroundUploadRoot(), rel);
  if (!abs) return;
  await rm(abs, { recursive: true, force: true });
}
