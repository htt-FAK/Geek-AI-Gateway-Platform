export type ThinkingStopId = "off" | "standard" | "max" | "on" | "low";

export type ThinkingStop = {
  id: ThinkingStopId;
  label: string;
};

/**
 * 各上游思考控制的真实能力（2026-11-20 经网关逐模型实测，见 logs/probe-thinking*.log）：
 * - deepseek-v4-pro：官方 deepseek provider，thinking + reasoning_effort(high/max)；
 *   deepseek-flash 上游忽略思考参数 → 隐藏控件。
 * - 百炼 Qwen（qwen4-max / qwen3.8-flash）、硅基流动 Qwen3.5 / 星辰：extra_body.enable_thinking 开关。
 * - Kimi：extra_body.thinking 可关，另有 reasoning_effort(low/high/max) 档位梯度。
 * - 智谱 GLM：思考常开（enable_thinking 仅支持 true），仅 reasoning_effort(low/high/max) 调档。
 * - MiniMax：关闭 = reasoning_effort low（实测无思考输出）；开启 = thinking.adaptive。
 * - 讯飞星火：extra_body.thinking 开关（effort 梯度不稳定，不暴露）。
 * - 商汤：思考常开，reasoning_effort(high/max) 两档（默认 high）。
 */
export type ThinkingProfile =
  | { kind: "none" }
  | { kind: "deepseek"; stops: ThinkingStop[] }
  | { kind: "mimo"; stops: ThinkingStop[] }
  /** 商汤日日新：思考常开不可关闭，仅以 reasoning_effort 区分强度 */
  | { kind: "sensenova"; stops: ThinkingStop[] }
  /** extra_body 上的开/关开关 */
  | { kind: "toggle"; stops: ThinkingStop[]; param: "enable_thinking" | "thinking" }
  /** 思考常开，仅 reasoning_effort 档位；带 off 时用 thinking 关闭（Kimi） */
  | { kind: "effort"; stops: ThinkingStop[]; offParam?: "thinking" }
  /** MiniMax：关闭 = reasoning_effort low，开启 = thinking.adaptive */
  | { kind: "minimax"; stops: ThinkingStop[] };

export type ThinkingRequestFields = {
  thinking?: { type: "enabled" | "disabled" | "adaptive" };
  reasoning_effort?: "high" | "max";
  /** 经网关透传到上游的 provider 专属参数（litellm drop_params 会丢顶层未知参数，extra_body 不会） */
  extra_body?: Record<string, unknown>;
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

/** 商汤无「关闭」档（思考不可关），只有力度两档。 */
const SENSENOVA_STOPS: ThinkingStop[] = [
  { id: "standard", label: "标准" },
  { id: "max", label: "最深" },
];

const TOGGLE_STOPS: ThinkingStop[] = [
  { id: "off", label: "关闭" },
  { id: "on", label: "开启" },
];

/** GLM 思考常开：低 / 标准(high) / 最深(max)。 */
const EFFORT_STOPS: ThinkingStop[] = [
  { id: "low", label: "低" },
  { id: "standard", label: "标准" },
  { id: "max", label: "最深" },
];

/** Kimi 可关 + 三档力度。 */
const EFFORT_WITH_OFF_STOPS: ThinkingStop[] = [
  { id: "off", label: "关闭" },
  { id: "low", label: "低" },
  { id: "standard", label: "标准" },
  { id: "max", label: "最深" },
];

/** Models that must hide the thinking-depth control. */
export function isThinkingUnsupported(model: string): boolean {
  const id = model.toLowerCase();
  if (id === "deepseek-flash") return true;
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
  if (id.startsWith("sensenova-")) {
    return { kind: "sensenova", stops: SENSENOVA_STOPS };
  }
  // 百炼 Qwen / 硅基流动 Qwen3.5、星辰：extra_body.enable_thinking
  if (id.startsWith("qwen") || id.startsWith("xing")) {
    return { kind: "toggle", stops: TOGGLE_STOPS, param: "enable_thinking" };
  }
  // Kimi：可关 + low/high/max 力度
  if (id.startsWith("kimi")) {
    return { kind: "effort", stops: EFFORT_WITH_OFF_STOPS, offParam: "thinking" };
  }
  // 智谱 GLM：思考常开，只调力度
  if (id.startsWith("glm")) {
    return { kind: "effort", stops: EFFORT_STOPS };
  }
  // MiniMax：低力度即无思考；开启用 thinking.adaptive
  if (id.startsWith("minimax")) {
    return { kind: "minimax", stops: TOGGLE_STOPS };
  }
  // 讯飞星火：extra_body.thinking 开关
  if (id.startsWith("spark")) {
    return { kind: "toggle", stops: TOGGLE_STOPS, param: "thinking" };
  }
  return { kind: "none" };
}

export function defaultThinkingStop(profile: ThinkingProfile): ThinkingStopId | null {
  if (profile.kind === "none") return null;
  if (profile.kind === "deepseek") return "standard";
  if (profile.kind === "sensenova") return "standard";
  if (profile.kind === "effort") return "standard";
  return "on";
}

export function thinkingStopToRequest(
  profile: ThinkingProfile,
  stop: ThinkingStopId | null,
): ThinkingRequestFields {
  if (profile.kind === "none") return {};

  // 商汤日日新：思考常开、不可关闭——任何档位都显式 enabled，只用 reasoning_effort 区分强度
  if (profile.kind === "sensenova") {
    return {
      thinking: { type: "enabled" },
      reasoning_effort: stop === "max" ? "max" : "high",
    };
  }

  // extra_body 开关类（Qwen / 星辰 / 星火）
  if (profile.kind === "toggle") {
    if (!stop) return {};
    const on = stop !== "off";
    if (profile.param === "enable_thinking") {
      return { extra_body: { enable_thinking: on } };
    }
    return { extra_body: { thinking: { type: on ? "enabled" : "disabled" } } };
  }

  // GLM / Kimi：reasoning_effort 档位（Kimi 可先关思考）
  if (profile.kind === "effort") {
    if (!stop) return {};
    if (stop === "off") {
      // 只有 Kimi 这类允许关闭的上游才会走到这里
      return { extra_body: { thinking: { type: "disabled" } } };
    }
    const effort = stop === "low" ? "low" : stop === "max" ? "max" : "high";
    return { extra_body: { reasoning_effort: effort } };
  }

  // MiniMax：低力度 = 无思考；开启 = adaptive
  if (profile.kind === "minimax") {
    if (!stop) return {};
    if (stop === "off") {
      return { extra_body: { reasoning_effort: "low" } };
    }
    return { thinking: { type: "adaptive" }, extra_body: { thinking: { type: "adaptive" } } };
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
      if (profile.kind !== "deepseek") {
        // deepseek-ocr 走 none 也无妨；deepseek 聊天模型必须是 3 档
        if (model === "deepseek-flash" || model === "deepseek-ocr") continue;
        throw new Error(`${model} must be DeepSeek 3-stop`);
      }
      if (profile.stops.length !== 3) {
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
      continue;
    }
    if (model.startsWith("mimo-") && !isThinkingUnsupported(model)) {
      if (profile.kind !== "mimo" || profile.stops.length !== 2) {
        throw new Error(`${model} must be MiMo 2-stop`);
      }
      const on = thinkingStopToRequest(profile, "on");
      if (on.thinking?.type !== "enabled" || on.reasoning_effort) {
        throw new Error(`${model} on-stop must enable thinking without effort`);
      }
      continue;
    }
    if (model.startsWith("sensenova-")) {
      if (profile.kind !== "sensenova" || profile.stops.length !== 2) {
        throw new Error(`${model} must be SenseNova 2-stop`);
      }
      if (profile.stops.some((s) => s.id === "off")) {
        throw new Error(`${model} must not offer an off stop (thinking always on)`);
      }
      const maxPayload = thinkingStopToRequest(profile, "max");
      if (maxPayload.thinking?.type !== "enabled" || maxPayload.reasoning_effort !== "max") {
        throw new Error(`${model} max stop mapping broken`);
      }
      const stdPayload = thinkingStopToRequest(profile, "standard");
      if (stdPayload.thinking?.type !== "enabled" || stdPayload.reasoning_effort !== "high") {
        throw new Error(`${model} standard stop mapping broken`);
      }
      continue;
    }
    if (model.startsWith("qwen") || model.startsWith("xing") || model.startsWith("spark")) {
      if (profile.kind !== "toggle" || profile.stops.length !== 2) {
        throw new Error(`${model} must be a 2-stop toggle`);
      }
      const off = thinkingStopToRequest(profile, "off");
      if (!off.extra_body) throw new Error(`${model} off-stop must set extra_body`);
      const on = thinkingStopToRequest(profile, "on");
      if (!on.extra_body) throw new Error(`${model} on-stop must set extra_body`);
      continue;
    }
    if (model.startsWith("glm")) {
      if (profile.kind !== "effort" || profile.stops.some((s) => s.id === "off")) {
        throw new Error(`${model} must be effort-only (thinking always on)`);
      }
      const low = thinkingStopToRequest(profile, "low");
      const max = thinkingStopToRequest(profile, "max");
      if (low.extra_body?.reasoning_effort !== "low" || max.extra_body?.reasoning_effort !== "max") {
        throw new Error(`${model} effort mapping broken`);
      }
      continue;
    }
    if (model.startsWith("kimi")) {
      if (profile.kind !== "effort" || !profile.offParam) {
        throw new Error(`${model} must be effort-with-off`);
      }
      const off = thinkingStopToRequest(profile, "off");
      const low = thinkingStopToRequest(profile, "low");
      const high = thinkingStopToRequest(profile, "standard");
      const max = thinkingStopToRequest(profile, "max");
      if (off.thinking?.type !== "disabled") throw new Error(`${model} off mapping broken`);
      if (
        low.extra_body?.reasoning_effort !== "low" ||
        high.extra_body?.reasoning_effort !== "high" ||
        max.extra_body?.reasoning_effort !== "max"
      ) {
        throw new Error(`${model} effort mapping broken`);
      }
      continue;
    }
    if (model.startsWith("minimax")) {
      if (profile.kind !== "minimax" || profile.stops.length !== 2) {
        throw new Error(`${model} must be Minimax 2-stop`);
      }
      const off = thinkingStopToRequest(profile, "off");
      const on = thinkingStopToRequest(profile, "on");
      if (off.extra_body?.reasoning_effort !== "low") throw new Error(`${model} off mapping broken`);
      if (on.thinking?.type !== "adaptive") throw new Error(`${model} on mapping broken`);
    }
  }
}