export type ThinkingStopId = "off" | "low" | "standard" | "max" | "on";

export type ThinkingStop = {
  id: ThinkingStopId;
  label: string;
};

export type ThinkingProfile =
  | { kind: "none" }
  | { kind: "deepseek"; stops: ThinkingStop[] }
  | { kind: "mimo"; stops: ThinkingStop[] }
  | { kind: "glm"; stops: ThinkingStop[] }
  | { kind: "glm53"; stops: ThinkingStop[] };

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

const GLM_STOPS: ThinkingStop[] = MIMO_STOPS;

/** GLM-5.3 / 5.3-Flash cannot disable thinking; only effort levels. */
const GLM53_STOPS: ThinkingStop[] = [
  { id: "low", label: "轻度" },
  { id: "standard", label: "标准" },
  { id: "max", label: "极深" },
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
  if (id.startsWith("glm-5.3")) {
    return { kind: "glm53", stops: GLM53_STOPS };
  }
  if (id.startsWith("glm-")) {
    return { kind: "glm", stops: GLM_STOPS };
  }
  return { kind: "none" };
}

export function defaultThinkingStop(profile: ThinkingProfile): ThinkingStopId | null {
  if (profile.kind === "none") return null;
  if (profile.kind === "deepseek" || profile.kind === "glm53") return "standard";
  return "on";
}

export function thinkingStopToRequest(
  profile: ThinkingProfile,
  stop: ThinkingStopId | null,
): ThinkingRequestFields {
  if (profile.kind === "none") return {};
  // GLM-5.3 rejects thinking.type=disabled; always send enabled + effort.
  if (profile.kind === "glm53") {
    const effort = stop === "max" ? "max" : stop === "low" ? "low" : "high";
    return { thinking: { type: "enabled" }, reasoning_effort: effort };
  }
  if (!stop || stop === "off") {
    return { thinking: { type: "disabled" } };
  }

  if (profile.kind === "deepseek") {
    if (stop === "max") {
      return { thinking: { type: "enabled" }, reasoning_effort: "max" };
    }
    return { thinking: { type: "enabled" }, reasoning_effort: "high" };
  }

  // mimo / glm-4.7
  return { thinking: { type: "enabled" } };
}
