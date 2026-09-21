"""LiteLLM callback: apply DeepSeek peak multiplier to response_cost before spend tracking."""

from __future__ import annotations

from typing import Any

from litellm.integrations.custom_logger import CustomLogger

from deepseek_peak import PEAK_MULTIPLIER, coerce_datetime, is_deepseek_model, is_peak, to_shanghai


class DeepSeekPeakPricingLogger(CustomLogger):
    def _adjust(self, kwargs: dict[str, Any], start_time: Any) -> None:
        model = kwargs.get("model")
        model_name = str(model) if model is not None else None
        if not is_deepseek_model(model_name):
            return

        sl = kwargs.get("standard_logging_object")
        metadata = sl.get("metadata") if isinstance(sl, dict) else None
        if isinstance(metadata, dict) and metadata.get("deepseek_peak"):
            return

        parsed = coerce_datetime(start_time)
        moment = to_shanghai(parsed)
        if not is_peak(moment):
            return

        base = kwargs.get("response_cost")
        if base is None and isinstance(sl, dict):
            base = sl.get("response_cost")
        if base is None:
            return

        adjusted = float(base) * PEAK_MULTIPLIER
        kwargs["response_cost"] = adjusted
        if isinstance(sl, dict):
            sl["response_cost"] = adjusted
            if not isinstance(metadata, dict):
                metadata = {}
                sl["metadata"] = metadata
            metadata["deepseek_peak"] = True
            metadata["deepseek_peak_multiplier"] = PEAK_MULTIPLIER
            metadata["currency"] = "CNY"

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._adjust(kwargs, start_time)

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        self._adjust(kwargs, start_time)


deepseek_peak_pricing_logger = DeepSeekPeakPricingLogger()
