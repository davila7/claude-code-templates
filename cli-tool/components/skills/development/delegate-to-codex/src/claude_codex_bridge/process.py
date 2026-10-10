from __future__ import annotations

import codecs
import collections
import io
import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


@dataclass(frozen=True)
class ProcessResult:
    exit_code: int | None
    stdout: str
    stderr: str
    elapsed_seconds: float
    timed_out: bool
    interrupted: bool
    cancelled: bool
    output_truncated: bool = False
    lines_skipped: int = 0  # stdout lines the line callback could not take (over the line limit, it raised, or late)
    stdout_abandoned: bool = False  # the stdout reader was still running when the call returned: lines may be missing


# After a kill, give the pipes this long to drain before giving up on any further output.
OUTPUT_GRACE_SECONDS = 10.0
CALLBACK_CLOSE_SECONDS = 5.0  # bounded wait for a running line callback once the run is over

_PROCESS_TERMINATE = 0x0001
_PROCESS_SET_QUOTA = 0x0100
_PROCESS_SUSPEND_RESUME = 0x0800
_CREATE_SUSPENDED = 0x00000004
_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
_JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9  # JobObjectExtendedLimitInformation


# ------------------------------------------------------------------ executable lookup

def _is_executable(candidate: Path) -> bool:
    try:
        return candidate.is_file() and os.access(candidate, os.X_OK)
    except OSError:
        return False


def which(name: str, *, path: str | None = None, suffixes: Sequence[str] | None = None) -> str | None:
    """Resolve an executable to an absolute path from PATH only, never from the current directory.

    ``shutil.which`` (like ``CreateProcess``) also searches the current directory on Windows, and the
    bridge's current directory is a repository it does not control. Empty and relative PATH entries, and
    an entry that is the current directory, are skipped; the result is always absolute. A ``name`` that
    already contains a directory is accepted only when it is absolute.
    """
    if os.path.dirname(name):
        candidate = Path(name)
        return str(candidate) if candidate.is_absolute() and _is_executable(candidate) else None
    if os.name == "nt":
        known = list(suffixes) if suffixes is not None else [
            ext for ext in os.environ.get("PATHEXT", ".COM;.EXE;.BAT;.CMD").split(os.pathsep) if ext]
        names = [name] if any(name.lower().endswith(ext.lower()) for ext in known) else [name + ext for ext in known]
    else:
        names = [name]
    try:
        current = os.path.normcase(os.path.realpath(os.getcwd()))
    except OSError:
        current = None
    for entry in (os.environ.get("PATH", "") if path is None else path).split(os.pathsep):
        entry = entry.strip().strip('"')
        if not entry or not os.path.isabs(entry):
            continue
        try:
            if current is not None and os.path.normcase(os.path.realpath(entry)) == current:
                continue
        except OSError:
            continue
        for candidate_name in names:
            candidate = Path(entry) / candidate_name
            if _is_executable(candidate):
                return str(candidate)
    return None


def system_tool(name: str) -> str | None:
    """Absolute path of a Windows system utility (taskkill, icacls) from System32, else from PATH."""
    if os.name == "nt":
        root = os.environ.get("SystemRoot") or os.environ.get("windir") or "C:\\Windows"
        candidate = Path(root) / "System32" / (name if name.lower().endswith(".exe") else name + ".exe")
        if candidate.is_file():
            return str(candidate)
    return which(name)


# ------------------------------------------------------------------ Windows Job Object

class _WindowsJob:
    """Job Object holding a worker and every descendant, so the tree dies even after the leader exits.

    ``taskkill /T`` walks parent links and needs the leader alive; a job does not. The job also has
    KILL_ON_JOB_CLOSE: when the last handle closes, including because the bridge itself was killed,
    Windows terminates every process still in it, so a dead bridge never leaves a live worker behind.
    Without a usable job (assignment refused, or an old Windows that cannot nest jobs) callers fall back
    to ``taskkill``.
    """

    def __init__(self, pid: int):
        self.handle = None
        self._kernel32 = None
        try:
            import ctypes
            from ctypes import wintypes

            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
            kernel32.CreateJobObjectW.restype = wintypes.HANDLE
            kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel32.OpenProcess.restype = wintypes.HANDLE
            kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
            kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
            kernel32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD]
            kernel32.SetInformationJobObject.restype = wintypes.BOOL
            kernel32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
            kernel32.TerminateJobObject.restype = wintypes.BOOL
            kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
            kernel32.CloseHandle.restype = wintypes.BOOL

            class IoCounters(ctypes.Structure):
                _fields_ = [(name, ctypes.c_ulonglong) for name in (
                    "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                    "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

            class BasicLimits(ctypes.Structure):
                _fields_ = [("PerProcessUserTimeLimit", ctypes.c_longlong), ("PerJobUserTimeLimit", ctypes.c_longlong),
                            ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                            ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                            ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                            ("SchedulingClass", wintypes.DWORD)]

            class ExtendedLimits(ctypes.Structure):
                _fields_ = [("BasicLimitInformation", BasicLimits), ("IoInfo", IoCounters),
                            ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                            ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

            job = kernel32.CreateJobObjectW(None, None)
            if not job:
                return
            limits = ExtendedLimits()
            limits.BasicLimitInformation.LimitFlags = _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            configured = bool(kernel32.SetInformationJobObject(
                job, _JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, ctypes.byref(limits), ctypes.sizeof(limits)))
            process = kernel32.OpenProcess(_PROCESS_SET_QUOTA | _PROCESS_TERMINATE, False, pid) if configured else None
            assigned = bool(process) and bool(kernel32.AssignProcessToJobObject(job, process))
            if process:
                kernel32.CloseHandle(process)
            if assigned:
                self.handle, self._kernel32 = job, kernel32
            else:
                kernel32.CloseHandle(job)
        except (OSError, AttributeError, ValueError):
            self.handle = None

    def terminate(self) -> bool:
        return bool(self.handle) and bool(self._kernel32.TerminateJobObject(self.handle, 1))

    def close(self) -> None:
        """Release the job; KILL_ON_JOB_CLOSE ends any process of the tree that is still alive."""
        if self.handle:
            self._kernel32.CloseHandle(self.handle)
            self.handle = None


def _resume_process(pid: int) -> bool:
    """Resume a process created suspended (all threads), so the job is in place before it runs anything."""
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        ntdll = ctypes.WinDLL("ntdll")
        ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]
        ntdll.NtResumeProcess.restype = ctypes.c_long
        handle = kernel32.OpenProcess(_PROCESS_SUSPEND_RESUME, False, pid)
        if not handle:
            return False
        try:
            return ntdll.NtResumeProcess(handle) == 0
        finally:
            kernel32.CloseHandle(handle)
    except (OSError, AttributeError, ValueError):
        return False


def start_process(argv: Sequence[str], **popen_options: Any) -> tuple[subprocess.Popen, _WindowsJob | None]:
    """Start a child that the bridge can always kill together with every descendant.

    Windows: the child is created suspended, placed in a KILL_ON_JOB_CLOSE job, then resumed, so it cannot
    start a grandchild outside the job and dies with the bridge. POSIX: the child leads its own session, so
    its process group can be signalled after the leader exits.
    """
    options = dict(popen_options)
    if os.name != "nt":
        options.setdefault("start_new_session", True)
        return subprocess.Popen(list(argv), shell=False, **options), None
    options["creationflags"] = (options.get("creationflags", 0) | subprocess.CREATE_NEW_PROCESS_GROUP
                                | _CREATE_SUSPENDED)
    child = subprocess.Popen(list(argv), shell=False, **options)
    job = _WindowsJob(child.pid)
    if not _resume_process(child.pid):
        try:
            child.kill()
            child.wait(timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            pass
        finally:
            for stream in (child.stdin, child.stdout, child.stderr):
                try:
                    if stream is not None:
                        stream.close()
                except (OSError, ValueError):
                    pass
            job.close()
        raise OSError(f"could not resume child process {child.pid} after job assignment")
    return child, job


def _kill_tree(process: subprocess.Popen[str], job: _WindowsJob | None = None) -> None:
    """Kill the worker and its descendants whether or not the leader is still alive.

    A descendant that outlives the leader can keep the captured pipes open, so this must not return
    early when the leader has already exited.
    """
    if os.name == "nt":
        terminated = job is not None and job.terminate()
        if process.poll() is None or not terminated:
            # Fallback for a missing job and for any descendant that started before the job assignment.
            taskkill = system_tool("taskkill")
            if taskkill:
                try:
                    subprocess.run(
                        [taskkill, "/PID", str(process.pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=15,
                        check=False,
                    )
                except (OSError, subprocess.TimeoutExpired):
                    pass
        if process.poll() is None:
            try:
                process.kill()
            except OSError:
                pass
    else:
        # start_new_session made the leader's pid the process-group id; the group outlives the leader
        # while any member remains, so signal it unconditionally.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except OSError:
            if process.poll() is None:
                process.kill()


def kill_tree(process: subprocess.Popen, job: _WindowsJob | None = None) -> None:
    """Kill ``process`` and everything it started (public name for the same operation)."""
    _kill_tree(process, job)


def release_tree(process: subprocess.Popen, job: _WindowsJob | None = None) -> None:
    """End any descendant still alive after the leader finished, then let go of the job."""
    if os.name == "nt":
        if job is not None:
            job.close()  # KILL_ON_JOB_CLOSE terminates survivors
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass


# Captured output is bounded so that a runaway worker or test cannot swamp the bridge or its disk: each stream
# keeps its first OUTPUT_HEAD_CHARS and its last OUTPUT_TAIL_CHARS characters, with a marker line naming how much
# was dropped.
OUTPUT_HEAD_CHARS = 1_000_000
OUTPUT_TAIL_CHARS = 3_000_000
# A stdout line longer than this is not handed to the line callback (it is still kept, with the rest of the
# output, in the head or tail): an unbounded line must not grow the bridge's memory.
MAX_LINE_CHARS = 8_000_000
_READ_SIZE = 65536


class _BoundedCapture:
    """Reads one pipe until it ends, keeping only the head and the tail of what it saw.

    The pipe is always read to the end (the child must never block on a full pipe); only the middle is discarded.
    Newlines are translated the way a text-mode pipe would (CRLF and lone CR become LF).

    ``on_line`` (optional) receives every complete line, newline removed, in order and before any of it can be
    discarded, so a caller can build a bounded summary of a stream whose middle the stored text will not hold.
    """

    def __init__(self, stream: Any, on_line: Callable[[str], None] | None = None):
        self.stream = stream
        self._on_line = on_line
        self._partial: list[str] = []
        self._partial_size = 0
        self._partial_overflow = False
        self.lines_skipped = 0
        self._deliver_lock = threading.Lock()
        self._closed = False
        self._decoder = io.IncrementalNewlineDecoder(codecs.getincrementaldecoder("utf-8")(errors="replace"),
                                                     translate=True)
        self._lock = threading.Lock()
        self._head: list[str] = []
        self._head_size = 0
        self._tail: collections.deque[str] = collections.deque()
        self._tail_size = 0
        self.dropped = 0

    def read_all(self) -> None:
        reader = getattr(self.stream, "read1", None) or self.stream.read
        try:
            while True:
                chunk = reader(_READ_SIZE)
                if not chunk:
                    break
                self._feed(self._decoder.decode(chunk))
            self._feed(self._decoder.decode(b"", final=True))
            self._finish_lines(complete=True)
        except (OSError, ValueError):
            # The pipe was closed under the reader (a kill that left a descendant holding it). A trailing partial
            # line cannot be trusted as a whole line, so it is counted as skipped rather than lost silently.
            self._finish_lines(complete=False)
        finally:
            try:
                self.stream.close()  # the reader owns its pipe: whoever outlives the run still never leaks it
            except (OSError, ValueError):
                pass

    def close(self, timeout: float = CALLBACK_CLOSE_SECONDS) -> bool:
        """Stop handing lines to the callback: a line that arrives afterwards is counted in ``lines_skipped``.

        Waits at most ``timeout`` seconds for a running callback to return. True means no callback is running
        and the consumer's state is final; False means one is still running, so its state may be incomplete.
        """
        if self._deliver_lock.acquire(timeout=timeout):
            try:
                self._closed = True
            finally:
                self._deliver_lock.release()
            return True
        self._closed = True  # the stuck callback's own line still counts; later lines are skipped
        return False

    def _deliver(self, line: str) -> None:
        with self._deliver_lock:
            if self._closed:
                self.lines_skipped += 1  # arrived after the run returned: the consumer has already been read
                return
            try:
                self._on_line(line)
            except Exception:  # a failing consumer must never stop the pipe being drained
                self.lines_skipped += 1

    def _split_lines(self, text: str) -> None:
        pieces = text.split("\n")
        for index, piece in enumerate(pieces):
            last = index == len(pieces) - 1
            if not self._partial_overflow:
                if self._partial_size + len(piece) > MAX_LINE_CHARS:
                    self._partial_overflow = True
                    self._partial.clear()
                    self._partial_size = 0
                else:
                    self._partial.append(piece)
                    self._partial_size += len(piece)
            if last:
                break
            if self._partial_overflow:
                self.lines_skipped += 1
            else:
                self._deliver("".join(self._partial))
            self._partial.clear()
            self._partial_size = 0
            self._partial_overflow = False

    def _finish_lines(self, *, complete: bool) -> None:
        if self._on_line is None:
            return
        if self._partial_overflow or (self._partial_size and not complete):
            self.lines_skipped += 1
        elif self._partial_size:
            self._deliver("".join(self._partial))
        self._partial.clear()
        self._partial_size = 0
        self._partial_overflow = False

    def _feed(self, text: str) -> None:
        if not text:
            return
        if self._on_line is not None:
            self._split_lines(text)
        with self._lock:
            room = OUTPUT_HEAD_CHARS - self._head_size
            if room > 0:
                self._head.append(text[:room])
                self._head_size += min(room, len(text))
                text = text[room:]
            if not text:
                return
            self._tail.append(text)
            self._tail_size += len(text)
            while self._tail_size > OUTPUT_TAIL_CHARS:
                excess = self._tail_size - OUTPUT_TAIL_CHARS
                first = self._tail[0]
                if len(first) <= excess:
                    self._tail.popleft()
                    dropped = len(first)
                else:
                    self._tail[0] = first[excess:]
                    dropped = excess
                self._tail_size -= dropped
                self.dropped += dropped

    def text(self) -> str:
        with self._lock:
            middle = f"\n[... {self.dropped} characters omitted by the bridge ...]\n" if self.dropped else ""
            return "".join(self._head) + middle + "".join(self._tail)


def _write_stdin(stream: Any, data: bytes) -> None:
    try:
        stream.write(data)
        stream.flush()
    except (OSError, ValueError):
        pass  # the child exited or closed its input before reading everything
    finally:
        try:
            stream.close()
        except (OSError, ValueError):
            pass


def _await_exit_and_output(process: subprocess.Popen, readers: Sequence[threading.Thread], started: float,
                           timeout_seconds: float) -> None:
    """Wait for the leader to exit and for every pipe to reach its end, all within the time limit.

    A descendant that outlives the leader keeps the pipes open, which counts as still running.
    """
    deadline = started + timeout_seconds
    process.wait(timeout=max(deadline - time.monotonic(), 0))
    for reader in readers:
        reader.join(timeout=max(deadline - time.monotonic(), 0))
        if reader.is_alive():
            raise subprocess.TimeoutExpired(process.args, timeout_seconds)


def _drain_after_kill(process: subprocess.Popen, readers: Sequence[threading.Thread]) -> None:
    """Let the readers collect what the pipes still hold after a kill, without ever waiting indefinitely."""
    deadline = time.monotonic() + OUTPUT_GRACE_SECONDS
    for reader in readers:
        reader.join(timeout=max(deadline - time.monotonic(), 0))
    # A descendant that escaped the kill may still hold the pipes. Never close a stream from this thread:
    # closing a buffered reader takes the lock its reader thread holds while blocked in read1(), so the
    # close would wait for the escaped descendant. The daemon readers are abandoned (they close their own
    # pipe if it ever ends) and whatever they captured so far is returned.
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def run_process(
    executable: str | Path,
    args: Sequence[str],
    *,
    cwd: str | Path,
    timeout_seconds: int | float,
    stdin_text: str | None = None,
    env: Mapping[str, str] | None = None,
    cancel_event: threading.Event | None = None,
    on_stdout_line: Callable[[str], None] | None = None,
) -> ProcessResult:
    """Run one program to completion, killing its whole process tree on a timeout, an interrupt or a cancel.

    ``cancel_event`` is for embedding callers (the tests use it): setting it ends the run like a kill.
    ``on_stdout_line`` is called, on a reader thread, with every complete stdout line (newline removed) before
    the bounded capture can drop any of it. A line over MAX_LINE_CHARS is skipped and counted in
    ``lines_skipped``, as is a call that raised, a trailing partial line cut off by a closed pipe, and a line that
    arrives after this function returned (no call is made then). ``stdout_abandoned`` says the stdout reader was
    still running at return, so lines may still be missing.
    """
    executable_path = Path(executable)
    if not executable_path.is_absolute():
        raise ValueError("executable must be an approved absolute path")
    if not executable_path.exists():
        raise FileNotFoundError(executable_path)
    cwd_path = Path(cwd).resolve(strict=True)

    started = time.monotonic()
    process, job = start_process(
        [str(executable_path), *args],
        cwd=str(cwd_path),
        stdin=subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=dict(env) if env is not None else None,
    )
    captures = [_BoundedCapture(process.stdout, on_stdout_line), _BoundedCapture(process.stderr)]
    readers = [threading.Thread(target=capture.read_all, name="process-output", daemon=True) for capture in captures]
    for reader in readers:
        reader.start()
    if stdin_text is not None:
        threading.Thread(target=_write_stdin, args=(process.stdin, stdin_text.encode("utf-8")),
                         name="process-input", daemon=True).start()
    timed_out = False
    interrupted = False
    cancelled_by_request = threading.Event()
    watcher_stop = threading.Event()

    def watch_for_cancellation() -> None:
        while not watcher_stop.wait(0.05):
            if cancel_event is not None and cancel_event.is_set():
                # Not gated on the leader: descendants may still hold the pipes after it exited.
                if not watcher_stop.is_set():
                    cancelled_by_request.set()
                    _kill_tree(process, job)
                return

    watcher = None
    if cancel_event is not None:
        watcher = threading.Thread(target=watch_for_cancellation, name="process-cancellation", daemon=True)
        watcher.start()
    try:
        _await_exit_and_output(process, readers, started, timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
        _kill_tree(process, job)
        _drain_after_kill(process, readers)
    except KeyboardInterrupt:
        interrupted = True
        _kill_tree(process, job)
        _drain_after_kill(process, readers)
    finally:
        watcher_stop.set()
        if watcher is not None:
            watcher.join(timeout=1)
        if job is not None:
            job.close()
        for stream, reader in zip((process.stdout, process.stderr), readers):
            if not reader.is_alive():  # a reader still blocked on its pipe owns it; closing then can hang on Windows
                try:
                    stream.close()
                except (OSError, ValueError):
                    pass
    callback_idle = captures[0].close()  # a reader abandoned past the grace period must not feed the callback from here on
    stdout_abandoned = on_stdout_line is not None and (readers[0].is_alive() or not callback_idle)
    if cancelled_by_request.is_set():
        interrupted = True
    return ProcessResult(
        exit_code=process.returncode,
        stdout=captures[0].text(),
        stderr=captures[1].text(),
        elapsed_seconds=round(time.monotonic() - started, 3),
        timed_out=timed_out,
        interrupted=interrupted,
        cancelled=cancelled_by_request.is_set(),
        output_truncated=any(capture.dropped for capture in captures),
        lines_skipped=captures[0].lines_skipped,
        stdout_abandoned=stdout_abandoned,
    )
