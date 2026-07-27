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
