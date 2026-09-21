"""Unit tests for DeepSeek peak pricing helpers."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from deepseek_peak import billable_cost, coerce_datetime, is_peak, to_shanghai

SH = ZoneInfo("Asia/Shanghai")
UTC = timezone.utc


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


def test_naive_datetime_treated_as_utc():
    # 01:00 naive → 01:00 UTC → 09:00 Shanghai (peak)
    naive_utc_peak = datetime(2026, 7, 20, 1, 0, 0)
    assert to_shanghai(naive_utc_peak).hour == 9
    assert is_peak(naive_utc_peak) is True
    # 04:00 naive → 12:00 Shanghai (off-peak lunch)
    naive_utc_lunch = datetime(2026, 7, 20, 4, 0, 0)
    assert is_peak(naive_utc_lunch) is False


def test_aware_utc_converts_to_shanghai():
    utc_peak = datetime(2026, 7, 20, 1, 0, tzinfo=UTC)
    assert is_peak(utc_peak) is True
    utc_off = datetime(2026, 7, 20, 4, 0, tzinfo=UTC)
    assert is_peak(utc_off) is False


def test_unix_timestamp_utc():
    # 2026-07-20 01:00:00 UTC
    ts = datetime(2026, 7, 20, 1, 0, tzinfo=UTC).timestamp()
    parsed = coerce_datetime(ts)
    assert parsed is not None
    assert is_peak(parsed) is True


def test_billable_cost_idempotent_via_metadata():
    moment = datetime(2026, 7, 20, 10, 0, tzinfo=SH)
    once = billable_cost(0.01, "deepseek-v4-flash", moment)
    assert once == 0.02
    twice = billable_cost(once, "deepseek-v4-flash", moment, metadata={"deepseek_peak": True})
    assert twice == 0.02
