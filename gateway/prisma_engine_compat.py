"""LiteLLM Prisma 引擎进程管理的 Windows 兼容补丁。

litellm 1.91.1 用 os.kill(pid, 0) 探测 query-engine 存活、os.kill(pid, SIGTERM/SIGKILL)
退休旧引擎。Windows 上对已死/被复用的 PID 调用 os.kill 会抛
SystemError("returned a result with an exception set"，底层 WinError 6 句柄无效)，
而原代码只捕获 (ProcessLookupError, PermissionError, OSError)，于是：
  - 存活轮询任务（_poll_engine_proc）直接崩溃，引擎死亡无人检测；
  - 重连路径（PrismaWrapper._kill_engine_process）崩溃，新引擎永远生不出来，
    网关 DB 层永久失联（readiness db=disconnected / "All connection attempts failed"）。
本模块在 win32 上把相关方法换成 ctypes OpenProcess/GetExitCodeProcess/TerminateProcess
实现：探测不杀进程、终止容忍死 PID、任何异常都不允许炸穿重连循环。
其他平台保持原实现。随 callbacks.py 导入生效；litellm 升级修复后可移除。
"""

from __future__ import annotations

import asyncio
import sys

if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    try:
        from litellm._logging import verbose_proxy_logger
        from litellm.proxy.db.prisma_client import PrismaWrapper
        from litellm.proxy.utils import PrismaClient
    except ImportError:  # 旧版 litellm（如 Compose 镜像 v1.83）无此内部结构：跳过补丁
        PrismaClient = None  # type: ignore[assignment]

if sys.platform == "win32" and PrismaClient is not None:

    _kernel32 = ctypes.windll.kernel32
    _PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    _PROCESS_TERMINATE = 0x0001
    _STILL_ACTIVE = 259
    _ERROR_INVALID_PARAMETER = 87

    def _win_pid_alive(pid: int) -> bool:
        """OpenProcess + GetExitCodeProcess 判存活（绝不终止进程）。"""
        if pid <= 0:
            return True
        handle = _kernel32.OpenProcess(_PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if handle:
            try:
                code = wintypes.DWORD()
                if _kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                    return code.value == _STILL_ACTIVE
                return False
            finally:
                _kernel32.CloseHandle(handle)
        # 打不开句柄：PID 不存在（87）视为已死；权限不足等保守视为存活
        return _kernel32.GetLastError() != _ERROR_INVALID_PARAMETER

    def _win_terminate(pid: int) -> None:
        if pid <= 0:
            return
        handle = _kernel32.OpenProcess(_PROCESS_TERMINATE, False, pid)
        if handle:
            try:
                _kernel32.TerminateProcess(handle, 1)
            finally:
                _kernel32.CloseHandle(handle)

    def _is_engine_alive(self) -> bool:
        try:
            return _win_pid_alive(self._engine_pid)
        except Exception:
            return True  # 探测异常保守视为存活，交给下一轮/看门狗

    async def _poll_engine_proc(self) -> None:
        """Windows 安全版存活轮询：逻辑与原版一致，探测不杀进程、异常不炸穿。"""
        while self._watching_engine and self._engine_pid > 0:
            try:
                alive = _win_pid_alive(self._engine_pid)
            except Exception:
                alive = True
            if not alive:
                dead_pid = self._engine_pid
                if self._consume_expected_death(dead_pid):
                    verbose_proxy_logger.info(
                        "prisma-query-engine PID %s gone as part of a planned "
                        "restart; not reconnecting (engine already replaced).",
                        dead_pid,
                    )
                    self._cleanup_engine_watcher()
                    return
                verbose_proxy_logger.error(
                    "prisma-query-engine PID %s gone; triggering reconnect.",
                    dead_pid,
                )
                self._engine_confirmed_dead = True
                self._reap_all_zombies()
                self._cleanup_engine_watcher()
                await self.attempt_db_reconnect(
                    reason="engine_process_death",
                    force=True,
                )
                return
            await asyncio.sleep(1)

    @staticmethod
    async def _kill_engine_process(pid: int) -> None:
        """Windows 安全版引擎退休：TerminateProcess 一步到位，死 PID 静默跳过。"""
        if pid <= 0:
            return
        try:
            if not _win_pid_alive(pid):
                return
            _win_terminate(pid)
            verbose_proxy_logger.warning(
                "Terminated prisma-query-engine PID %s during reconnect (Windows).",
                pid,
            )
        except Exception:
            return  # 已死或不可访问：重连循环必须继续

    PrismaClient._is_engine_alive = _is_engine_alive
    PrismaClient._poll_engine_proc = _poll_engine_proc
    PrismaWrapper._kill_engine_process = _kill_engine_process