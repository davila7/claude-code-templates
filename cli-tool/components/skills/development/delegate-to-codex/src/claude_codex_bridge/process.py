from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence


@dataclass(frozen=True)
class ProcessResult:
    exit_code: int | None
    stdout: str
    stderr: str
    elapsed_seconds: float
    timed_out: bool
    interrupted: bool
    cancelled: bool


def _kill_tree(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            process.kill()
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except OSError:
            process.kill()


def run_process(
    executable: str | Path,
    args: Sequence[str],
    *,
    cwd: str | Path,
    timeout_seconds: int | float,
    stdin_text: str | None = None,
    env: Mapping[str, str] | None = None,
    cancel_event: threading.Event | None = None,
) -> ProcessResult:
    executable_path = Path(executable)
    if not executable_path.is_absolute():
        raise ValueError("executable must be an approved absolute path")
    if not executable_path.exists():
        raise FileNotFoundError(executable_path)
    cwd_path = Path(cwd).resolve(strict=True)

    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    started = time.monotonic()
    process = subprocess.Popen(
        [str(executable_path), *args],
        cwd=str(cwd_path),
        stdin=subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=False,
        env=dict(env) if env is not None else None,
        creationflags=creationflags,
        start_new_session=os.name != "nt",
    )
    timed_out = False
    interrupted = False
    cancelled_by_request = threading.Event()
    watcher_stop = threading.Event()

    def watch_for_cancellation() -> None:
        while not watcher_stop.wait(0.05):
            if cancel_event is not None and cancel_event.is_set():
                if process.poll() is None:
                    cancelled_by_request.set()
                    _kill_tree(process)
                return

    watcher = None
    if cancel_event is not None:
        watcher = threading.Thread(target=watch_for_cancellation, name="process-cancellation", daemon=True)
        watcher.start()
    try:
        stdout, stderr = process.communicate(input=stdin_text, timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_tree(process)
        stdout, stderr = process.communicate()
    except KeyboardInterrupt:
        interrupted = True
        _kill_tree(process)
        stdout, stderr = process.communicate()
    finally:
        watcher_stop.set()
        if watcher is not None:
            watcher.join(timeout=1)
    if cancelled_by_request.is_set():
        interrupted = True
    return ProcessResult(
        exit_code=process.returncode,
        stdout=stdout,
        stderr=stderr,
        elapsed_seconds=round(time.monotonic() - started, 3),
        timed_out=timed_out,
        interrupted=interrupted,
        cancelled=cancelled_by_request.is_set(),
    )
