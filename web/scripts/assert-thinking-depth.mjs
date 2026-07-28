/**
 * Smoke-assert thinking-depth mapping contract (mirrors src/lib/thinking-depth.ts).
 * Run: node scripts/assert-thinking-depth.mjs
 */

const MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "mimo-v2.5-pro",
  "mimo-v2.5-pro-ultraspeed",
  "mimo-v2.5",
  "mimo-v2.5-asr",
  "mimo-v2.5-tts",
  "mimo-v2.5-tts-voiceclone",
  "mimo-v2.5-tts-voicedesign",
];

function isThinkingUnsupported(model) {
  const id = model.toLowerCase();
  if (id === "deepseek-v4-flash") return true;
  if (id.includes("-asr")) return true;
  if (id.includes("-tts")) return true;
  return false;
}

function profileKind(model) {
  if (isThinkingUnsupported(model)) return "none";
  if (model.startsWith("deepseek-")) return "deepseek";
  if (model.startsWith("mimo-")) return "mimo";
  return "none";
}

function toRequest(kind, stop) {
  if (kind === "none") return {};
  if (stop === "off") return { thinking: { type: "disabled" } };
  if (kind === "deepseek") {
    if (stop === "max") return { thinking: { type: "enabled" }, reasoning_effort: "max" };
    return { thinking: { type: "enabled" }, reasoning_effort: "high" };
  }
  return { thinking: { type: "enabled" } };
}

let failed = 0;
function check(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  }
}

for (const model of MODELS) {
  const kind = profileKind(model);
  if (model === "deepseek-v4-flash" || model.includes("-asr") || model.includes("-tts")) {
    check(kind === "none", `${model} must be none`);
    check(Object.keys(toRequest(kind, "on")).length === 0, `${model} must send no thinking fields`);
    continue;
  }
  if (model === "deepseek-v4-pro") {
    check(kind === "deepseek", `${model} deepseek`);
    const max = toRequest(kind, "max");
    check(max.reasoning_effort === "max" && max.thinking?.type === "enabled", `${model} max`);
    const std = toRequest(kind, "standard");
    check(std.reasoning_effort === "high", `${model} standard`);
  }
  if (model.startsWith("mimo-") && kind === "mimo") {
    const on = toRequest(kind, "on");
    check(on.thinking?.type === "enabled" && !on.reasoning_effort, `${model} on`);
  }
}

if (failed) {
  console.error(`assert-thinking-depth: ${failed} failure(s)`);
  process.exit(1);
}
console.log("assert-thinking-depth: ok");
