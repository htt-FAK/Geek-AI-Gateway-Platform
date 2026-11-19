export type SpendKind = "chat" | "summary" | "memory";

/** 用量图里把摘要和记忆从同名模型的对话费用里拆开。chat 保持原模型名。 */
export function spendSeriesModel(model: string, kind: string | null | undefined): string {
  if (kind === "memory") return `${model} · 记忆`;
  if (kind === "summary") return `${model} · 摘要`;
  return model;
}

function asKind(value: unknown): SpendKind | null {
  if (value === "chat" || value === "summary" || value === "memory") return value;
  return null;
}

/** 从网关花费日志的 metadata / tags 里认出调试台打上的 kind。 */
export function kindFromUnknown(value: unknown): SpendKind | null {
  const direct = asKind(value);
  if (direct) return direct;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const asText = asKind(trimmed);
    if (asText) return asText;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return kindFromUnknown(JSON.parse(trimmed) as unknown);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const kind = kindFromUnknown(item);
      if (kind === "memory" || kind === "summary") return kind;
    }
    for (const item of value) {
      const kind = kindFromUnknown(item);
      if (kind) return kind;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const fromKind = kindFromUnknown(rec.kind);
    if (fromKind) return fromKind;
    return kindFromUnknown(rec.tags);
  }
  return null;
}
