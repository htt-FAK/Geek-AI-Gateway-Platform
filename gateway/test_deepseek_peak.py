"""Unit tests for DeepSeek peak pricing helpers."""

from datetime import datetime
from zoneinfo import ZoneInfo

from deepseek_peak import billable_cost, is_peak

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
    assert billable_cost(0.01, "deepseek-v4-flash", moment) == 0.02
    assert billable_cost(0.01, "deepseek/deepseek-v4-pro", moment) == 0.02


def test_billable_cost_offpeak_and_mimo_unchanged():
    moment = datetime(2026, 7, 20, 13, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-v4-flash", moment) == 0.01
    peak = datetime(2026, 7, 20, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "mimo-v2.5-pro", peak) == 0.01


def test_weekend_is_never_peak():
    # 2026-07-25 is Saturday, 2026-07-26 is Sunday (Beijing): all day off-peak.
    sat_slot = datetime(2026, 7, 25, 10, 0, tzinfo=SH)
    sun_slot = datetime(2026, 7, 26, 15, 0, tzinfo=SH)
    sat_late = datetime(2026, 7, 25, 20, 0, tzinfo=SH)
    assert is_peak(sat_slot) is False
    assert is_peak(sun_slot) is False
    assert is_peak(sat_late) is False


def test_weekend_peak_window_does_not_multiply():
    sat_slot = datetime(2026, 7, 25, 10, 0, tzinfo=SH)
    assert billable_cost(0.01, "deepseek-v4-flash", sat_slot) == 0.01
    assert billable_cost(0.01, "deepseek/deepseek-v4-pro", sat_slot) == 0.01
