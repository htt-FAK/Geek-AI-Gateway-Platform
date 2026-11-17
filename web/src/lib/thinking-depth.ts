export type ThinkingStopId = "off" | "standard" | "max" | "on" | "low" | "high";

export type ThinkingStop = {
  id: ThinkingStopId;
  label: string;
};

export type ThinkingProfile =
  | { kind: "none" }
  | { kind: "deepseek"; stops: ThinkingStop[] }
  | { kind: "mimo"; stops: ThinkingStop[] }
  | { kind: "glm"; stops: ThinkingStop[] };

export type ThinkingRequestFields = {
  thinking?: { type: "enabled" | "disabled" };
  reasoning_effort?: "low" | "high" | "max";
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

/** GLM-5.3-Flash cannot disable thinking. Official efforts: low / high / max. */
const GLM_STOPS: ThinkingStop[] = [
  { id: "low", label: "轻量" },
  { id: "high", label: "增强" },
  { id: "max", label: "深度" },
];

/** Models that must hide the thinking-depth control. */
export function isThinkingUnsupported(model: string): boolean {
  const id = model.toLowerCase();
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
  if (id.startsWith("glm-")) {
    return { kind: "glm", stops: GLM_STOPS };
  }
  return { kind: "none" };
}

export function defaultThinkingStop(profile: ThinkingProfile): ThinkingStopId | null {
  if (profile.kind === "none") return null;
  if (profile.kind === "deepseek") return "standard";
  if (profile.kind === "glm") return "max";
  return "on";
}

export function thinkingStopToRequest(
  profile: ThinkingProfile,
  stop: ThinkingStopId | null,
): ThinkingRequestFields {
  if (profile.kind === "glm") {
    const effort = stop === "low" ? "low" : stop === "high" ? "high" : "max";
    return { thinking: { type: "enabled" }, reasoning_effort: effort };
  }

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
    if (model.startsWith("glm-")) {
      if (profile.kind !== "glm" || profile.stops.length !== 3) {
        throw new Error(`${model} must be GLM 3-stop`);
      }
      const maxPayload = thinkingStopToRequest(profile, "max");
      if (maxPayload.reasoning_effort !== "max" || maxPayload.thinking?.type !== "enabled") {
        throw new Error(`${model} max stop mapping broken`);
      }
      const low = thinkingStopToRequest(profile, "low");
      if (low.reasoning_effort !== "low" || low.thinking?.type !== "enabled") {
        throw new Error(`${model} low stop mapping broken`);
      }
      const forced = thinkingStopToRequest(profile, "off");
      if (forced.thinking?.type !== "enabled") {
        throw new Error(`${model} must not disable thinking`);
      }
    }
  }
}
