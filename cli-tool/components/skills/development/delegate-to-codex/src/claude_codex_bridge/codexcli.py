"""Codex CLI discovery, subscription-only preflight, and plan usage through `codex app-server`.

Usage windows are identified by their reported duration, never by position. A plan may
report no five-hour window at all (only a weekly one). That is a trusted state, not an
error: the weekly window then governs capacity on its own.
"""
from __future__ import annotations

import glob
import json
import math
import os
import queue
import subprocess
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import __version__
from .process import kill_tree, release_tree, run_process, start_process, which
from .gitops import atomic_write_json

# Environment variables that would route Codex away from the signed-in ChatGPT subscription.
BILLING_OVERRIDES = ("OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL", "OPENAI_API_BASE", "AZURE_OPENAI_API_KEY")
FIVE_HOUR_MAX_MINUTES = 720          # anything up to 12h is treated as the short ("five-hour") window
WEEKLY_MIN_MINUTES = 6 * 24 * 60     # anything from 6 days up is treated as the weekly window
USAGE_CACHE_TTL_SECONDS = 60.0
APP_SERVER_TIMEOUT_SECONDS = 30.0


class CodexCliError(RuntimeError):
    pass


@dataclass(frozen=True)
class CodexCommand:
    """Absolute executable plus any fixed leading arguments (used for test doubles)."""
    executable: Path
    prefix: tuple[str, ...] = field(default_factory=tuple)

    def args(self, *rest: str) -> list[str]:
        return [*self.prefix, *rest]

    def public(self) -> dict[str, Any]:
        return {"executable": str(self.executable), "prefix_args": list(self.prefix)}


def _native_from_shim(shim: Path) -> Path | None:
    """npm installs a .cmd/.ps1 shim; prefer the bundled native binary beside it."""
    base = shim.parent / "node_modules" / "@openai" / "codex"
    patterns = [
        str(base / "node_modules" / "@openai" / "codex-*" / "vendor" / "*" / "bin" / "codex.exe"),
        str(base / "node_modules" / "@openai" / "codex-*" / "vendor" / "*" / "bin" / "codex"),
        str(base / "vendor" / "*" / "codex" / "codex.exe"),
        str(base / "vendor" / "*" / "bin" / "codex.exe"),
    ]
    for pattern in patterns:
        found = sorted(glob.glob(pattern))
        if found:
            return Path(found[0]).resolve()
    return None


def find_codex() -> CodexCommand:
    override = os.environ.get("CODEX_BRIDGE_COMMAND")
    if override:
        try:
            parts = json.loads(override)
        except json.JSONDecodeError as exc:
            raise CodexCliError("CODEX_BRIDGE_COMMAND must be a JSON array of strings") from exc
        if not isinstance(parts, list) or not parts or any(not isinstance(p, str) or not p for p in parts):
            raise CodexCliError("CODEX_BRIDGE_COMMAND must be a non-empty JSON array of strings")
        executable = Path(parts[0])
        if not executable.is_absolute() or not executable.is_file():
            raise CodexCliError("CODEX_BRIDGE_COMMAND must start with an absolute executable path")
        return CodexCommand(executable.resolve(), tuple(parts[1:]))
    candidates: list[Path] = []
    # PATH only, never the current directory (a repository the bridge was pointed at could plant codex.exe).
    for name in ("codex.exe", "codex"):
        found = which(name)
        if found:
            candidates.append(Path(found))
    for name in ("codex.cmd", "codex.ps1"):
        found = which(name)
        if found:
            native = _native_from_shim(Path(found))
            if native:
                candidates.append(native)
    local = os.environ.get("LOCALAPPDATA")
    if local:
        app_bin = Path(local) / "OpenAI" / "Codex" / "bin"
        candidates.append(app_bin / "codex.exe")
        # The Codex desktop app installs the CLI in per-version folders (bin/<hash>/codex.exe)
        # and leaves older folders behind; prefer the most recently written binary.
        versioned = [Path(p) for p in glob.glob(str(app_bin / "*" / "codex.exe"))]
        candidates.extend(sorted(versioned, key=lambda p: p.stat().st_mtime, reverse=True))
    for candidate in candidates:
        if candidate.suffix.lower() in {".cmd", ".ps1", ".bat"}:
            continue
        if candidate.is_file():
            return CodexCommand(candidate.resolve())
    raise CodexCliError(
        "Codex CLI not found on PATH, behind an npm shim, or under %LOCALAPPDATA%\\OpenAI\\Codex\\bin. Install it "
        "(npm install -g @openai/codex, the official installer or the Codex app) or set CODEX_BRIDGE_COMMAND to a "
        "JSON array whose first item is the absolute codex executable."
    )


def billing_overrides() -> list[str]:
    # Presence only: the value of a credential variable is never read (an empty one still routes elsewhere).
    return [name for name in BILLING_OVERRIDES if name in os.environ]


def codex_version(command: CodexCommand) -> str:
    result = run_process(command.executable, command.args("--version"), cwd=Path.home(), timeout_seconds=20)
    if result.exit_code != 0 or result.timed_out:
        raise CodexCliError("codex --version failed")
    return (result.stdout or result.stderr).strip()


# ------------------------------------------------------------------ app-server

class AppServer:
    """Minimal newline-delimited JSON-RPC client for `codex app-server` over stdio."""

    def __init__(self, command: CodexCommand, *, timeout: float = APP_SERVER_TIMEOUT_SECONDS):
        self.timeout = timeout
        # The server and everything it starts live in a KILL_ON_JOB_CLOSE job (POSIX: their own session),
        # so close() ends the whole tree and a killed bridge leaves no app-server behind.
        self.process, self.job = start_process(
            [str(command.executable), *command.args("app-server")],
            cwd=str(Path.home()), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", errors="replace",
        )
        self._lines: queue.Queue[str | None] = queue.Queue()
        self._reader = threading.Thread(target=self._read, daemon=True)
        self._reader.start()
        self._next_id = 0

    def _read(self) -> None:
        assert self.process.stdout is not None
        for line in self.process.stdout:
            self._lines.put(line)
        self._lines.put(None)

    def _send(self, message: dict[str, Any]) -> None:
        assert self.process.stdin is not None
        try:
            self.process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
            self.process.stdin.flush()
        except (OSError, ValueError) as exc:  # BrokenPipeError when the server just died; ValueError when closed
            raise CodexCliError(f"codex app-server is not accepting input: {exc}") from exc

    def request(self, method: str, params: Any = None) -> Any:
        self._next_id += 1
        request_id = self._next_id
        message: dict[str, Any] = {"id": request_id, "method": method}
        if params is not None:
            message["params"] = params
        self._send(message)
        deadline = time.monotonic() + self.timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise CodexCliError(f"codex app-server did not answer {method} in time")
            try:
                line = self._lines.get(timeout=remaining)
            except queue.Empty as exc:
                raise CodexCliError(f"codex app-server did not answer {method} in time") from exc
            if line is None:
                raise CodexCliError(f"codex app-server exited before answering {method}")
            try:
                reply = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(reply, dict) or reply.get("id") != request_id:
                continue  # notifications and unrelated replies
            if "error" in reply:
                error = reply["error"] if isinstance(reply["error"], dict) else {}
                raise CodexCliError(f"codex app-server {method} failed: {error.get('message', 'unknown error')}")
            return reply.get("result")

    def notify(self, method: str, params: Any = None) -> None:
        message: dict[str, Any] = {"method": method}
        if params is not None:
            message["params"] = params
        self._send(message)

    def close(self) -> None:
        try:
            if self.process.stdin:
                self.process.stdin.close()
        except OSError:
            pass
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            kill_tree(self.process, getattr(self, "job", None))
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass  # leave an unkillable process to the OS rather than hang the bridge
        release_tree(self.process, getattr(self, "job", None))  # descendants that outlived the server
        try:
            if self.process.stdout and self.process.poll() is not None:
                self.process.stdout.close()
        except (OSError, ValueError):
            pass

    def __enter__(self) -> "AppServer":
        try:
            self.request("initialize", {"clientInfo": {"name": "claude-codex-bridge", "version": __version__}})
            self.notify("initialized")
        except BaseException:
            # __exit__ is not called when __enter__ raises, so stop the spawned server here.
            self.close()
            raise
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


def read_account_and_limits(command: CodexCommand) -> tuple[dict[str, Any], dict[str, Any] | None, str | None]:
    """Return (account record, raw rate-limit result or None, rate-limit error or None)."""
    with AppServer(command) as server:
        account_result = server.request("account/read", {"refreshToken": False})
        limits: dict[str, Any] | None = None
        limits_error: str | None = None
        try:
            value = server.request("account/rateLimits/read", {"excludeResetCreditDetails": True})
            limits = value if isinstance(value, dict) else None
            if limits is None:
                limits_error = "rate-limit response was not an object"
        except CodexCliError as exc:
            limits_error = str(exc)
    account = account_result.get("account") if isinstance(account_result, dict) else None
    return (account if isinstance(account, dict) else {}), limits, limits_error


def check_subscription_account(account: dict[str, Any]) -> dict[str, Any]:
    kind = account.get("type")
    if kind != "chatgpt":
        if kind == "apiKey":
            raise CodexCliError("Codex is signed in with an API key; sign in with ChatGPT (`codex login`) instead")
        if not kind:
            raise CodexCliError("Codex is not signed in; run `codex login` and complete the ChatGPT sign-in")
        raise CodexCliError(f"Codex account type {kind!r} is not a ChatGPT subscription")
    return {"auth_method": "chatgpt", "plan_type": account.get("planType"), "identity_fields_recorded": False}


# ------------------------------------------------------------------ usage

def _window(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    used = raw.get("usedPercent")
    if not isinstance(used, (int, float)) or isinstance(used, bool):
        return None
    used = max(0.0, min(100.0, float(used)))
    minutes = raw.get("windowDurationMins")
    resets = raw.get("resetsAt")
    return {
        "applicable": True,
        "used_percent": used,
        "remaining_percent": round(100.0 - used, 3),
        "window_minutes": minutes if isinstance(minutes, int) and not isinstance(minutes, bool) else None,
        "resets_at": datetime.fromtimestamp(resets, timezone.utc).isoformat() if isinstance(resets, int) else None,
    }


def classify_usage(result: dict[str, Any]) -> dict[str, Any]:
    """Turn an `account/rateLimits/read` result into a capacity gate.

    - A missing five-hour window is trusted as "this plan has none"; the weekly window governs.
    - Any reported window at 0% remaining is exhaustion.
    - No usable window at all (and no explicit block) is unknown, which pauses work.
    """
    snapshot = result.get("rateLimits") if isinstance(result, dict) else None
    snapshot = snapshot if isinstance(snapshot, dict) else {}
    five_hour: dict[str, Any] | None = None
    weekly: dict[str, Any] | None = None
    other: list[dict[str, Any]] = []
    for key in ("primary", "secondary"):
        window = _window(snapshot.get(key))
        if window is None:
            continue
        window["slot"] = key
        minutes = window["window_minutes"]
        if minutes is not None and minutes <= FIVE_HOUR_MAX_MINUTES and five_hour is None:
            five_hour = window
        elif minutes is not None and minutes >= WEEKLY_MIN_MINUTES and weekly is None:
            weekly = window
        else:
            other.append(window)
    ordinary = result.get("ordinaryUsageAllowed") if isinstance(result, dict) else None
    reached = snapshot.get("rateLimitReachedType")
    record: dict[str, Any] = {
        "source": "codex app-server account/rateLimits/read",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "plan_type": snapshot.get("planType"),
        "limit_id": snapshot.get("limitId"),
        "five_hour": five_hour or {"applicable": False, "reason": "no five-hour window reported for this plan (trusted, not an error)"},
        "weekly": weekly or {"applicable": False, "reason": "no weekly window reported"},
        "other_windows": other,
        "ordinary_usage_allowed": ordinary if isinstance(ordinary, bool) else None,
        "rate_limit_reached_type": reached if isinstance(reached, str) else None,
    }
    governing = [name for name, window in (("five_hour", five_hour), ("weekly", weekly)) if window]
    governing += [f"other:{w['window_minutes']}" for w in other]
    record["governing_windows"] = governing
    spent = [(name, window) for name, window in (("five_hour", five_hour), ("weekly", weekly))
             if window and window["remaining_percent"] <= 0]
    spent += [(f"other:{w['window_minutes']}", w) for w in other if w["remaining_percent"] <= 0]
    # An explicit billing/credit/account block outranks exhaustion: waiting for a window reset would not help,
    # so it must never be reported as exhausted. Only the provider's own rate_limit_reached marker keeps
    # an ordinaryUsageAllowed=false report in the exhausted class.
    reached_type = record["rate_limit_reached_type"]
    explicit_block = reached_type != "rate_limit_reached" and (
        reached_type is not None or record["ordinary_usage_allowed"] is False)
    if explicit_block:
        record.update(gate="blocked",
                      gate_reason=f"account blocked: {reached_type or 'ordinary usage not allowed'}")
    elif spent or reached_type == "rate_limit_reached":
        reset = "; ".join(f"{name} resets {window['resets_at'] or 'at an unreported time'}" for name, window in spent)
        record.update(gate="exhausted",
                      gate_reason="exhausted window: " + (reset or "provider reported rate_limit_reached"))
    elif not governing:
        record.update(gate="unknown", gate_reason="no usage window was reported")
    else:
        record.update(gate="available",
                      gate_reason="capacity remains in: " + ", ".join(governing))
    return record


def read_usage_cache(cache_path: Path, *, max_age: float | None = USAGE_CACHE_TTL_SECONDS) -> dict[str, Any] | None:
    """Read a valid snapshot without starting Codex; max_age=None permits a post-run snapshot."""
    if cache_path is not None:
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if not isinstance(cached, dict) or cached.get("gate") not in {"available", "exhausted", "blocked"}:
                raise ValueError("invalid usage cache")
            cached_at = cached["_cached_at"]
            if isinstance(cached_at, bool) or not isinstance(cached_at, (int, float)) or not math.isfinite(cached_at):
                raise ValueError("invalid cache timestamp")
            age = time.time() - cached_at
            if age >= 0 and (max_age is None or age <= max_age):
                cached["retrieval"] = {"mode": "cache", "age_seconds": round(age, 1)}
                cached.pop("_cached_at", None)
                return cached
        except (OSError, ValueError, TypeError, KeyError, OverflowError):
            pass
    return None


def _cached_codex_version(cache_path: Path, command: CodexCommand) -> str | None:
    """The version recorded by an earlier preflight, or a fresh `codex --version` when the cache has none."""
    try:
        previous = json.loads(cache_path.read_text(encoding="utf-8"))
        version = previous.get("_codex_version") if isinstance(previous, dict) else None
        if isinstance(version, str) and version:
            return version
    except (OSError, ValueError):
        pass
    try:
        return codex_version(command)
    except (CodexCliError, OSError):
        return None


def fetch_usage(command: CodexCommand, cache_path: Path | None = None, *, use_cache: bool = True) -> dict[str, Any]:
    if use_cache and cache_path is not None:
        cached = read_usage_cache(cache_path)
        if cached is not None:
            return cached
    account, limits, error = read_account_and_limits(command)
    check_subscription_account(account)
    if limits is None:
        record = {"source": "codex app-server account/rateLimits/read", "gate": "unknown",
                  "gate_reason": f"usage unavailable: {error}", "retrieved_at": datetime.now(timezone.utc).isoformat()}
    else:
        record = classify_usage(limits)
    record["retrieval"] = {"mode": "live", "age_seconds": 0}
    if cache_path is not None and record["gate"] != "unknown":
        # Keep the Codex version preflight recorded, so a later cache-hit preflight does not report None.
        extra = {"_codex_version": version} if (version := _cached_codex_version(cache_path, command)) else {}
        atomic_write_json(cache_path, {**record, "_cached_at": time.time(), **extra})
    return record
