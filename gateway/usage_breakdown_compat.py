"""MiMo 截断思考的 usage 口径补丁（计费精度）。

MiMo v2.6 思考被 max_tokens 截断（finish_reason=length）时，上游
usage.completion_tokens_details.reasoning_tokens 仍按「未截断」口径上报
（实测 44/45），超过 usage.completion_tokens（实际生成上限，如 40）。
litellm 1.91.1 的成本计算器按 breakdown 计费：
text = max(0, completion - reasoning) = 0，再加 reasoning × 输出价，
于是生成 40 token 却按 45 token 收钱，超收约 +10%（叠加缓存折扣后
表现为历史「MiMo ±8% 口径差」的另一半来源）。

上游自身计费与 usage.completion_tokens（实际生成数）同口径；breakdown
只是信息字段，截断时自相矛盾。本补丁在解析层把 breakdown 各项之和钳制到
completion_tokens（溢出优先从 reasoning 扣减），保证计费总量 = 实际生成量。
sum <= total 时原样返回（DeepSeek 等正常模型不受影响）。全平台生效；
litellm / 上游修复后可移除（随 callbacks.py 导入）。
"""

from __future__ import annotations

try:
    from litellm.litellm_core_utils.llm_cost_calc import utils as _cost_utils
    from litellm.types.utils import Usage

    _orig_parse = _cost_utils._parse_completion_tokens_details
except (ImportError, AttributeError):  # 旧版 litellm（如 Compose 镜像 v1.83）：跳过补丁
    _cost_utils = None  # type: ignore[assignment]

if _cost_utils is not None:
    def _clamped_parse(usage: "Usage"):
        result = _orig_parse(usage)
        total = int(getattr(usage, "completion_tokens", 0) or 0)
        breakdown_sum = (
            result["audio_tokens"]
            + result["text_tokens"]
            + result["reasoning_tokens"]
            + result["image_tokens"]
        )
        overflow = breakdown_sum - total
        if total > 0 and overflow > 0:
            # 溢出优先扣 reasoning（已知矛盾字段），其次 audio/image/text
            for key in ("reasoning_tokens", "audio_tokens", "image_tokens", "text_tokens"):
                if overflow <= 0:
                    break
                cut = min(result[key], overflow)
                result[key] -= cut
                overflow -= cut
        return result

    _cost_utils._parse_completion_tokens_details = _clamped_parse