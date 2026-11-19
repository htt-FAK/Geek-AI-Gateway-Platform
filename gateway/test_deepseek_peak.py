"""Unit tests for DeepSeek peak pricing helpers."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from deepseek_peak import PUBLIC_HOLIDAYS, billable_cost, is_peak

SH = ZoneInfo("Asia/Shanghai")


def test_peak_windows_beijing():
    assert is_peak(datetime(2026, 7, 20, 9, 0, tzinfo=SH)) is True
    assert is_peak(datetime(2026, 7, 20, 11, 59, tzinfo=SH)) is True
    assert is_peak(datetime(2026, 7, 20, 12, 0, tzinfo=SH)) is False
    assert is_peak(datetime(2026, 7, 20, 14, 0, tzinfo=SH)) is True
    assert is_peak(datetime(2026, 7, 20, 17, 59, tzinfo=SH)) is True
    assert is_peak(datetime(2026, 7, 20, 18, 0, tzinfo=SH)) is False
    assert is_peak(datetime(2026, 7, 20, 8, 59, tzinfo=SH)) is False


def test_billable_cost_deepseek_peak_doubles():
    moment = datetime(2026, 7, 20, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", moment) == 0.02
    assert billable_cost(0.01, "deepseek/deepseek-v4-pro", moment) == 0.02


def test_billable_cost_offpeak_and_mimo_unchanged():
    moment = datetime(2026, 7, 20, 13, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", moment) == 0.01
    peak = datetime(2026, 7, 20, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "mimo-v2.6-pro", peak) == 0.01


def test_billable_cost_weekend_offpeak():
    # 2026-07-25 是周六：落在峰时窗口内也按空闲价计费
    saturday = datetime(2026, 7, 25, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", saturday) == 0.01
    sunday = datetime(2026, 7, 26, 15, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-v4-pro", sunday) == 0.01


def test_billable_cost_public_holiday_offpeak():
    # 2026-10-01 国庆（周四）、2026-02-17 春节（周二）：峰时窗口内仍按空闲价
    national = datetime(2026, 10, 1, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", national) == 0.01
    spring = datetime(2026, 2, 17, 15, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-v4-pro", spring) == 0.01
    # 调休补班周六（2026-02-14）按官方「周一至周五」口径仍为错峰
    makeup = datetime(2026, 2, 14, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", makeup) == 0.01
    # 普通工作日峰时照常加倍（2026-11-18 周三）
    weekday = datetime(2026, 11, 18, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-flash", weekday) == 0.02


def test_2027_public_holidays_offpeak():
    # 2027 年安排（国办发明电〔2026〕10号，2026-11-05 公布，gov.cn 原文核对）：
    # 节假日全天错峰，即使落在工作日峰时窗口内。
    holidays = [
        datetime(2027, 1, 1, 10, 0, tzinfo=SH),   # 元旦（周五）
        datetime(2027, 2, 5, 10, 0, tzinfo=SH),   # 春节除夕（周五）
        datetime(2027, 2, 8, 15, 0, tzinfo=SH),   # 春节假期内（周一）
        datetime(2027, 2, 13, 10, 0, tzinfo=SH),  # 春节最后一天（周六）
        datetime(2027, 4, 5, 10, 0, tzinfo=SH),   # 清明（周一）
        datetime(2027, 5, 3, 10, 0, tzinfo=SH),   # 劳动节假期内（周一）
        datetime(2027, 6, 9, 10, 0, tzinfo=SH),   # 端午（周三，仅 1 天）
        datetime(2027, 9, 15, 15, 0, tzinfo=SH),  # 中秋（周三，仅 1 天）
        datetime(2027, 10, 1, 10, 0, tzinfo=SH),  # 国庆（周五）
        datetime(2027, 10, 7, 15, 0, tzinfo=SH),  # 国庆最后一天（周四）
    ]
    for moment in holidays:
        assert billable_cost(0.01, "deepseek-flash", moment) == 0.01
        assert moment.date() in PUBLIC_HOLIDAYS


def test_2027_makeup_workday_weekends_still_offpeak():
    # 2027 调休补班：1/31（日）、2/14（日）、5/8（六）、9/26（日）、10/9（六）。
    # 全部落在周末 —— 按官方「周一至周五」峰时口径仍为错峰，不列入节假日表。
    makeup = [date(2027, 1, 31), date(2027, 2, 14), date(2027, 5, 8),
              date(2027, 9, 26), date(2027, 10, 9)]
    for day in makeup:
        assert day.weekday() >= 5  # 表没抄错：补班日确为周末
        assert day not in PUBLIC_HOLIDAYS
        moment = datetime(day.year, day.month, day.day, 10, 0, tzinfo=SH)
        assert is_peak(moment) is False
        assert billable_cost(0.01, "deepseek-flash", moment) == 0.01


def test_2027_normal_weekday_still_peak():
    # 假期结束后的普通工作日峰时照常 ×2（防止节假日表多圈日期）
    assert billable_cost(0.01, "deepseek-flash", datetime(2027, 2, 15, 10, 0, tzinfo=SH)) == 0.02  # 春节后周一
    assert billable_cost(0.01, "deepseek-flash", datetime(2027, 6, 10, 10, 0, tzinfo=SH)) == 0.02  # 端午后周四
    assert billable_cost(0.01, "deepseek-flash", datetime(2027, 9, 16, 15, 0, tzinfo=SH)) == 0.02  # 中秋后周四
    assert billable_cost(0.01, "deepseek-flash", datetime(2027, 10, 8, 10, 0, tzinfo=SH)) == 0.02  # 国庆后周五
