"""DeepSeek peak/off-peak pricing helpers (Asia/Shanghai).

Official rule (DeepSeek-V4, effective 2026-08-17; weekend rule 2026-08-23):
peak hours charge 2x the off-peak rate for all billable items. Peak windows
(Beijing time): 09:00-12:00 and 14:00-18:00, weekdays only. The whole of
Saturday/Sunday is off-peak.
"""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")
PEAK_MULTIPLIER = 2.0
PEAK_WINDOWS = (
    (time(9, 0), time(12, 0)),
    (time(14, 0), time(18, 0)),
)


def to_shanghai(moment: datetime | None = None) -> datetime:
    if moment is None:
        return datetime.now(tz=SHANGHAI)
    if moment.tzinfo is None:
        return moment.replace(tzinfo=SHANGHAI)
    return moment.astimezone(SHANGHAI)


def is_peak(moment: datetime | None = None) -> bool:
    """True iff `moment` (default now) is a DeepSeek peak hour (Beijing time).

    Peak is 09:00-12:00 and 14:00-18:00, weekdays (Mon-Fri) only. The whole of
    Saturday/Sunday is off-peak, so any time on a weekend returns False.
    """
    local = to_shanghai(moment)
    if local.weekday() >= 5:  # Sat=5, Sun=6
        return False
    clock = local.timetz().replace(tzinfo=None)
    for start, end in PEAK_WINDOWS:
        if start <= clock < end:
            return True
    return False


def is_deepseek_model(model: str | None) -> bool:
    if not model:
        return False
    lowered = model.lower()
    return "deepseek" in lowered


def billable_cost(base_cost: float, model: str | None, moment: datetime | None = None) -> float:
    if base_cost <= 0 or not is_deepseek_model(model):
        return float(base_cost)
    if is_peak(moment):
        return float(base_cost) * PEAK_MULTIPLIER
    return float(base_cost)
