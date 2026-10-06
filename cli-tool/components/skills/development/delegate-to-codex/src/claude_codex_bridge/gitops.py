"""Git, worktree and task-lock helpers shared by the Codex and Grok worker bridges."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Sequence

from .contracts import TASK_ID_RE, Task


class BridgeError(RuntimeError):
    pass


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def atomic_write_json(path: Path, value: Any) -> None:
    """Publish a complete JSON file; concurrent writers each own their temporary file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", suffix=".tmp", delete=False) as out:
            temporary = Path(out.name)
            json.dump(value, out, indent=2, ensure_ascii=False)
            out.write("\n")
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError as exc:
                # Windows replacement can briefly conflict with another reader/writer's handle.
                if attempt == 4 or os.name != "nt" or getattr(exc, "winerror", None) not in (5, 32, 33):
                    raise
                time.sleep(0.01 * 2 ** attempt)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _git_executable() -> str:
    value = shutil.which("git")
    if not value:
        raise BridgeError("Git is not available")
    return value


def _git(cwd: Path, args: Sequence[str], *, check: bool = True,
         env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        [_git_executable(), *args],
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
        shell=False,
        check=False,
        env=env,
    )
    if check and result.returncode != 0:
        raise BridgeError(f"Git command failed: {' '.join(args)}\n{result.stderr.strip()}")
    return result


def _git_retry(cwd: Path, args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    """Retry repository-lock contention during setup/cleanup, at most five attempts."""
    for attempt in range(5):
        try:
            return _git(cwd, args)
        except BridgeError as exc:
            message = str(exc).lower()
            if attempt == 4 or not any(term in message for term in (
                    "index.lock", ".lock': file exists", '.lock\": file exists',
                    "unable to create", "cannot lock ref")):
                raise
            time.sleep(0.5 * 2 ** attempt)
    raise AssertionError("unreachable")


def _verify_repository(task: Task) -> None:
    root = _git(task.repo_root, ["rev-parse", "--show-toplevel"]).stdout.strip()
    if Path(root).resolve() != task.repo_root:
        raise BridgeError("repo_root must be the Git top-level directory")
    resolved = _git(task.repo_root, ["rev-parse", "--verify", f"{task.base_commit}^{{commit}}"]).stdout.strip().lower()
    if resolved != task.base_commit:
        raise BridgeError("base_commit did not resolve to the exact requested commit")


def changed_paths(worktree: Path, base_commit: str) -> list[str]:
    tracked = _git(worktree, ["diff", "--name-only", "-z", base_commit, "--"]).stdout.split("\0")
    untracked = _git(worktree, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout.split("\0")
    return sorted({path.replace("\\", "/") for path in (*tracked, *untracked) if path})


def complete_diff(worktree: Path, base_commit: str) -> str:
    return tree_diff(worktree, base_commit, snapshot_tree(worktree))


def snapshot_tree(worktree: Path, directory: Path | None = None) -> str:
    """Return the tree of the worktree's current content, normalized through Git's clean filters.

    The tree is built in the worktree's own (linked-worktree) index, which is saved byte-for-byte first
    and restored afterwards, so no environment copy is needed. The primary checkout has a different
    index file and is never touched. ``directory`` is accepted for compatibility and ignored.

    Race assumption: callers hold the per-task lock and the worker and validation processes have
    already exited when a snapshot is taken, so nothing else uses this worktree's index meanwhile.
    """
    raw = _git(worktree, ["rev-parse", "--git-path", "index"]).stdout.strip()
    index = Path(raw) if Path(raw).is_absolute() else worktree / raw
    saved = index.read_bytes() if index.is_file() else None
    try:
        # Start from HEAD (as the former temporary index did) so stale stat data cannot skip re-cleaning.
        _git(worktree, ["read-tree", "HEAD"])
        _git(worktree, ["add", "-A", "--", "."])
        return _git(worktree, ["write-tree"]).stdout.strip()
    finally:
        if saved is None:
            index.unlink(missing_ok=True)
        else:
            holder = index.with_name(index.name + ".delegate-restore")
            holder.write_bytes(saved)
            os.replace(holder, index)


def tree_diff(repository: Path, before: str, after: str, files: Sequence[str] = ()) -> str:
    return _git(repository, ["diff", "--binary", "--no-ext-diff", "--no-textconv", "--no-renames",
                             before, after, "--", *(f":(literal){p}" for p in files)]).stdout


def tree_diffstat(repository: Path, before: str, after: str) -> dict[str, Any]:
    args = ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", before, after]
    stat = _git(repository, [*args, "--stat", "--stat-width=100", "--"]).stdout.rstrip()
    fields = _git(repository, [*args, "--numstat", "-z", "--"]).stdout.split("\0")
    files = []
    for field in fields:
        if field:
            added, removed, path = field.split("\t", 2)
            files.append({"path": path, "added": int(added) if added != "-" else None,
                          "removed": int(removed) if removed != "-" else None})
    return {"stat": stat, "files": files}


def _worktree_fingerprint(worktree: Path, base_commit: str) -> str:
    digest = hashlib.sha256()
    for path in changed_paths(worktree, base_commit):
        digest.update(path.encode("utf-8") + b"\0")
        object_hash = _git(worktree, ["hash-object", "--", path], check=False)
        digest.update((object_hash.stdout.strip() if object_hash.returncode == 0 else "<deleted>").encode())
    return digest.hexdigest()


def path_allowed(path: str, permitted: Sequence[str]) -> bool:
    candidate = PurePosixPath(path.replace("\\", "/"))
    for item in permitted:
        boundary = PurePosixPath(item[:-3].rstrip("/") if item.endswith("/**") else item)
        if candidate == boundary or boundary in candidate.parents:
            return True
    return False


def primary_status(task: Task) -> str:
    return _git(task.repo_root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout


def _unquote_git_path(raw: str) -> str:
    if not raw.startswith('"'):
        return raw
    # Git quotes UTF-8 bytes with octal escapes, which JSON decoding does not support.
    escapes = {"a": b"\a", "b": b"\b", "t": b"\t", "n": b"\n", "v": b"\v",
               "f": b"\f", "r": b"\r", '"': b'"', "\\": b"\\"}
    parts = re.split(r'(\\[0-7]{3}|\\.)', raw[1:-1])
    data = b"".join((bytes([int(part[1:], 8)]) if re.fullmatch(r'\\[0-7]{3}', part)
                     else escapes[part[1:]]) if part.startswith("\\") else part.encode("utf-8")
                    for part in parts)
    return data.decode("utf-8", errors="replace")


def status_line_paths(line: str) -> list[str]:
    """Parse porcelain v1, preserving spaces and both sides of a rename/copy."""
    raw = line[3:]
    if "R" in line[:2] or "C" in line[:2]:
        quoted = escaped = False
        for index, char in enumerate(raw):
            if escaped:
                escaped = False
            elif quoted and char == "\\":
                escaped = True
            elif char == '"':
                quoted = not quoted
            elif not quoted and raw.startswith(" -> ", index):
                return [_unquote_git_path(raw[:index]), _unquote_git_path(raw[index + 4:])]
    return [_unquote_git_path(raw)] if raw else []


def primary_status_changes(before: str, after: str) -> list[str]:
    """Include added, removed and changed status entries; ignore unchanged dirty paths."""
    lines = set(before.splitlines()) ^ set(after.splitlines())
    return sorted({path for line in lines for path in status_line_paths(line)})


# ---------------------------------------------------------------- task locks

def _active_lock_path(artifact_root: Path, task_id: str) -> Path:
    if not TASK_ID_RE.fullmatch(task_id):
        raise BridgeError("task_id is invalid")
    return artifact_root / ".active" / f"{task_id}.json"


def pid_is_running(pid: Any) -> bool:
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.GetExitCodeProcess.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5  # access denied still proves the process exists
        try:
            code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True  # refuse destructive recovery when state cannot be proven
            return code.value == 259
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


@contextmanager
def task_lock(artifact_root: Path, task: Task, task_file: Path, operation: str) -> Iterator[Path]:
    (artifact_root / ".active").mkdir(parents=True, exist_ok=True)
    lock = _active_lock_path(artifact_root, task.task_id)
    record = {
        "task_id": task.task_id, "status": "RUNNING", "operation": operation, "pid": os.getpid(),
        "started_at": utc_now(), "timeout_seconds": task.timeout_seconds,
        "task_file": str(Path(task_file).resolve(strict=True)),
    }
    try:
        with lock.open("x", encoding="utf-8") as handle:
            json.dump(record, handle, indent=2)
            handle.write("\n")
    except FileExistsError as exc:
        raise BridgeError(
            f"task {task.task_id!r} already has an active run; wait for that process instead of starting another"
        ) from exc
    try:
        yield lock
    finally:
        lock.unlink(missing_ok=True)


def active_task_record(artifact_root: Path, task_id: str) -> dict[str, Any]:
    lock = _active_lock_path(artifact_root, task_id)
    if not lock.exists():
        return {"task_id": task_id, "status": "NOT_RUNNING", "lock_path": str(lock)}
    try:
        record = json.loads(lock.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BridgeError(f"active-task lock is invalid: {lock}") from exc
    if not isinstance(record, dict) or record.get("task_id") != task_id:
        raise BridgeError(f"active-task lock does not match task {task_id!r}")
    return {**record, "process_running": pid_is_running(record.get("pid")), "lock_path": str(lock)}


def clear_stale_task_lock(artifact_root: Path, task_id: str) -> dict[str, Any]:
    record = active_task_record(artifact_root, task_id)
    if record.get("status") == "NOT_RUNNING":
        return record
    if record.get("process_running") is True:
        raise BridgeError(f"task {task_id!r} still has a running owner process")
    lock = Path(record["lock_path"]).resolve(strict=True)
    if lock.parent != (artifact_root / ".active").resolve(strict=True):
        raise BridgeError("active-task lock is outside the configured lock directory")
    stale = artifact_root / ".stale-locks"
    stale.mkdir(parents=True, exist_ok=True)
    destination = stale / f"{task_id}-{utc_stamp()}.json"
    lock.replace(destination)
    return {"task_id": task_id, "status": "STALE_LOCK_ARCHIVED", "archived_lock": str(destination), "previous": record}
