"""DeepSeek peak/off-peak pricing helpers (Asia/Shanghai).

Official rule: peak hours charge 2x the off-peak rate for all billable items.
Peak windows (Beijing time): Mon-Fri 09:00-12:00 and 14:00-18:00, excluding
Chinese public holidays. Weekends and holidays are off-peak all day.

⚠ 每年要换表：法定节假日表（_holidays_2026 / _holidays_2027 / PUBLIC_HOLIDAYS）
目前维护到 2027 年。国务院办公厅每年 11 月左右公布次年安排，届时必须新增
_holidays_YYYY 并更新 PUBLIC_HOLIDAYS，否则新的一年节假日会按峰时计费。
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")
PEAK_MULTIPLIER = 2.0
PEAK_WINDOWS = (
    (time(9, 0), time(12, 0)),
    (time(14, 0), time(18, 0)),
)

# 中国法定节假日（国务院办公厅每年公布）。需按年维护；
# 列入的日期全天按空闲价计费，即使落在峰时窗口内。
# 调休补班日若落在周末，按官方「周一至周五」口径仍为错峰，无需列入。
def _expand(ranges: list[tuple[date, date]]) -> set[date]:
    days: set[date] = set()
    for start, end in ranges:
        day = start
        while day <= end:
            days.add(day)
            day += timedelta(days=1)
    return days


# 2026 年安排（2025-11-04 公布，国办发明电〔2025〕7号）；
# 调休补班 1/4、2/14、2/28、5/9、9/20、10/10 均落在周末，仍为错峰。
def _holidays_2026() -> set[date]:
    return _expand([
        (date(2026, 1, 1), date(2026, 1, 3)),    # 元旦
        (date(2026, 2, 15), date(2026, 2, 23)),  # 春节（腊月二十八起）
        (date(2026, 4, 4), date(2026, 4, 6)),    # 清明
        (date(2026, 5, 1), date(2026, 5, 5)),    # 劳动节
        (date(2026, 6, 19), date(2026, 6, 21)),  # 端午
        (date(2026, 9, 25), date(2026, 9, 27)),  # 中秋
        (date(2026, 10, 1), date(2026, 10, 7)),  # 国庆
    ])


# 2027 年安排（2026-11-05 公布，国办发明电〔2026〕10号，gov.cn 原文核对）；
# 调休补班 1/31（日）、2/14（日）、5/8（六）、9/26（日）、10/9（六）均落在周末，仍为错峰。
# 注意：2027 端午 6/9、中秋 9/15 均为周三，只放 1 天，无调休。
def _holidays_2027() -> set[date]:
    return _expand([
        (date(2027, 1, 1), date(2027, 1, 3)),    # 元旦
        (date(2027, 2, 5), date(2027, 2, 13)),   # 春节（除夕 2/5 起）
        (date(2027, 4, 3), date(2027, 4, 5)),    # 清明
        (date(2027, 5, 1), date(2027, 5, 5)),    # 劳动节
        (date(2027, 6, 9), date(2027, 6, 9)),    # 端午
        (date(2027, 9, 15), date(2027, 9, 15)),  # 中秋
        (date(2027, 10, 1), date(2027, 10, 7)),  # 国庆
    ])


PUBLIC_HOLIDAYS: set[date] = _holidays_2026() | _holidays_2027()


def to_shanghai(moment: datetime | None = None) -> datetime:
    if moment is None:
        return datetime.now(tz=SHANGHAI)
    if moment.tzinfo is None:
        return moment.replace(tzinfo=SHANGHAI)
    return moment.astimezone(SHANGHAI)


def is_peak(moment: datetime | None = None) -> bool:
    local = to_shanghai(moment)
    if local.weekday() >= 5:  # 周六 / 周日全天错峰
        return False
    if local.date() in PUBLIC_HOLIDAYS:
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
