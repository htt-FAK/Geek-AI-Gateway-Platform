export type ThinkingStopId = "off" | "standard" | "max" | "on";

export type ThinkingStop = {
  id: ThinkingStopId;
  label: string;
};

export type ThinkingProfile =
  | { kind: "none" }
  | { kind: "deepseek"; stops: ThinkingStop[] }
  | { kind: "mimo"; stops: ThinkingStop[] };

export type ThinkingRequestFields = {
  thinking?: { type: "enabled" | "disabled" };
  reasoning_effort?: "high" | "max";
};

const DEEPSEEK_STOPS: ThinkingStop[] = [
  { id: "off", label: "关闭" },
  { id: "standard", label: "标准" },
  { id: "max", label: "极深" },
];

const MIMO_STOPS: ThinkingStop[] = [
  { id: "off", label: "关闭" },
  { id: "on", label: "开启" },
];

/** Models that must hide the thinking-depth control. */
export function isThinkingUnsupported(model: string): boolean {
  const id = model.toLowerCase();
  if (id === "deepseek-v4-flash") return true;
  if (id.includes("-asr")) return true;
  if (id.includes("-tts")) return true;
  return false;
}

export function getThinkingProfile(model: string): ThinkingProfile {
  if (isThinkingUnsupported(model)) {
    return { kind: "none" };
  }
  const id = model.toLowerCase();
  if (id.startsWith("deepseek-")) {
    return { kind: "deepseek", stops: DEEPSEEK_STOPS };
  }
  if (id.startsWith("mimo-")) {
    return { kind: "mimo", stops: MIMO_STOPS };
  }
  return { kind: "none" };
}

export function defaultThinkingStop(profile: ThinkingProfile): ThinkingStopId | null {
  if (profile.kind === "none") return null;
  if (profile.kind === "deepseek") return "standard";
  return "on";
}

export function thinkingStopToRequest(
  profile: ThinkingProfile,
  stop: ThinkingStopId | null,
): ThinkingRequestFields {
  if (profile.kind === "none" || !stop || stop === "off") {
    if (profile.kind === "none") return {};
    return { thinking: { type: "disabled" } };
  }

  if (profile.kind === "deepseek") {
    if (stop === "max") {
      return { thinking: { type: "enabled" }, reasoning_effort: "max" };
    }
    return { thinking: { type: "enabled" }, reasoning_effort: "high" };
  }

  // mimo
  return { thinking: { type: "enabled" } };
}

/** Smoke-assert catalog mapping; throws on contract break. */
export function assertThinkingDepthContract(models: readonly string[]): void {
  for (const model of models) {
    const profile = getThinkingProfile(model);
    if (isThinkingUnsupported(model)) {
      if (profile.kind !== "none") {
        throw new Error(`${model} must hide thinking depth`);
      }
      continue;
    }
    if (model.startsWith("deepseek-")) {
      if (profile.kind !== "deepseek" || profile.stops.length !== 3) {
        throw new Error(`${model} must be DeepSeek 3-stop`);
      }
      const maxPayload = thinkingStopToRequest(profile, "max");
      if (maxPayload.reasoning_effort !== "max" || maxPayload.thinking?.type !== "enabled") {
        throw new Error(`${model} max stop mapping broken`);
      }
      const std = thinkingStopToRequest(profile, "standard");
      if (std.reasoning_effort !== "high") {
        throw new Error(`${model} standard stop mapping broken`);
      }
    }
    if (model.startsWith("mimo-") && !isThinkingUnsupported(model)) {
      if (profile.kind !== "mimo" || profile.stops.length !== 2) {
        throw new Error(`${model} must be MiMo 2-stop`);
      }
      const on = thinkingStopToRequest(profile, "on");
      if (on.thinking?.type !== "enabled" || on.reasoning_effort) {
        throw new Error(`${model} on-stop must enable thinking without effort`);
      }
    }
  }
}
