"""DeepSeek peak/off-peak pricing helpers (Asia/Shanghai).

Official rule (expected mid-July): peak hours charge 2x the normal rate for all
billable items. Peak windows (Beijing time): 09:00-12:00 and 14:00-18:00.
"""

from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Any
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")
UTC = timezone.utc
PEAK_MULTIPLIER = 2.0
PEAK_WINDOWS = (
    (time(9, 0), time(12, 0)),
    (time(14, 0), time(18, 0)),
)


def coerce_datetime(moment: Any) -> datetime | None:
    """Normalize LiteLLM start_time to a datetime.

    Naive datetimes are treated as UTC (LiteLLM's usual logging clock).
    Unix timestamps are interpreted as UTC seconds.
    """
    if moment is None:
        return None
    if isinstance(moment, datetime):
        return moment
    if isinstance(moment, (int, float)) and not isinstance(moment, bool):
        return datetime.fromtimestamp(float(moment), tz=UTC)
    return None


def to_shanghai(moment: datetime | None = None) -> datetime:
    if moment is None:
        return datetime.now(tz=SHANGHAI)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(SHANGHAI)


def is_peak(moment: datetime | None = None) -> bool:
    local = to_shanghai(moment)
    clock = local.time()
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False


def is_deepseek_model(model: str | None) -> bool:
    if not model:
        return False
    lowered = model.lower()
    return "deepseek" in lowered


def billable_cost(
    base_cost: float,
    model: str | None,
    moment: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> float:
    if metadata and metadata.get("deepseek_peak"):
        return float(base_cost)
    if base_cost <= 0 or not is_deepseek_model(model):
        return float(base_cost)
    if is_peak(moment):
        return float(base_cost) * PEAK_MULTIPLIER
    return float(base_cost)
