import { getMarketModel } from "@/lib/model-market";

const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * 图片只接受 base64 data URL（png/jpeg/webp/gif）。
 * 不把 http:// 外链转给网关——网关侧可能去拉取任意 URL。
 * 单张解码后 ≤5MB。
 */
export function validateImageDataUrl(url: string): string | null {
  const matched = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url.trim());
  if (!matched) {
    return "仅支持 base64 data URL 图片（data:image/png|jpeg|webp|gif），不接受外链";
  }
  const mime = matched[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    return `不支持的图片类型 ${mime}，仅支持 png/jpeg/webp/gif`;
  }
  const bytes = Buffer.byteLength(matched[2], "base64");
  if (bytes > MAX_IMAGE_BYTES) {
    return "单张图片解码后不能超过 5MB";
  }
  return null;
}

export function validateImageDataUrls(model: string, urls: readonly string[]): string | null {
  if (urls.length === 0) return null;
  if (urls.length > 4) return "单次最多 4 张图片";
  for (const url of urls) {
    const error = validateImageDataUrl(url);
    if (error) return error;
  }
  const market = getMarketModel(model);
  if (!market?.capabilities.vision) {
    return `模型 ${model} 不支持图像输入`;
  }
  return null;
}
