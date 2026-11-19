"""LiteLLM callback: apply DeepSeek peak multiplier to response_cost before spend tracking."""

from __future__ import annotations

from typing import Any, Optional

from litellm.integrations.custom_logger import CustomLogger

import prisma_engine_compat  # noqa: F401  side-effect: Windows 引擎存活探测/重连兼容
import rerank_compat  # noqa: F401  side-effect: 修复硅基流动 rerank 的 document: null
import usage_breakdown_compat  # noqa: F401  side-effect: MiMo 截断思考 breakdown 超 completion 的超收
from deepseek_peak import billable_cost, is_deepseek_model, is_peak, to_shanghai


class DeepSeekPeakPricingLogger(CustomLogger):
    def _adjust(self, kwargs: dict[str, Any], start_time: Any) -> None:
        model = kwargs.get("model")
        if not is_deepseek_model(str(model) if model is not None else None):
            return

        moment = to_shanghai(start_time if hasattr(start_time, "tzinfo") else None)
        if not is_peak(moment):
            return

        base = kwargs.get("response_cost")
        sl = kwargs.get("standard_logging_object")
        if base is None and isinstance(sl, dict):
            base = sl.get("response_cost")
        if base is None or float(base) <= 0:
            # 0 成本（限时免费）模型不打峰时标记
            return

        adjusted = billable_cost(float(base), str(model), moment)
        kwargs["response_cost"] = adjusted
        if isinstance(sl, dict):
            sl["response_cost"] = adjusted
            metadata = sl.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}
                sl["metadata"] = metadata
            metadata["deepseek_peak"] = True
            metadata["deepseek_peak_multiplier"] = 2.0
            metadata["currency"] = "CNY"

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._adjust(kwargs, start_time)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._adjust(kwargs, start_time)


deepseek_peak_pricing_logger = DeepSeekPeakPricingLogger()
