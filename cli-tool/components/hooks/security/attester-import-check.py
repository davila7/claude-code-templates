#!/usr/bin/env python3
"""Attester Import Check: Claude Code PreToolUse hook.

Checks package imports in Write/Edit/MultiEdit calls against the
attester.dev existence oracle before the write lands. Blocks (exit 2) on a
confident "does not exist" answer; the stderr message is shown to the
agent so it can fix the import. Quota exhaustion, offline, and payload
problems fail open (exit 0): a guard that blocks the wrong edit is worse
than one that misses one.

Free keyless tier: 25 calls/day per client IP, reset 00:00 UTC. Answers
are cached at ~/.cache/attester-import-check/cache.json (exists 30 days,
negatives 1 day) so routine editing rarely spends quota.

Python 3.10+ standard library only. No pip install step.

Env:
    ATTESTER_IMPORT_CHECK_WARN_ONLY=1  never block, only print
    ATTESTER_IMPORT_CHECK_NO_CACHE=1   skip the answer cache
    ATTESTER_BASE_URL                  default https://attester.dev
"""

from __future__ import annotations

import ast
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get("ATTESTER_BASE_URL", "https://attester.dev").rstrip("/")
CACHE_PATH = Path.home() / ".cache" / "attester-import-check" / "cache.json"
TTL_POSITIVE_S = 30 * 24 * 3600
TTL_NEGATIVE_S = 24 * 3600
TIMEOUT_S = 10.0

PY_EXTS = {".py", ".pyi"}
JS_EXTS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"}
HOOK_TOOLS = {"Write", "Edit", "MultiEdit"}
NODE_BUILTINS = frozenset(
    """
    assert async_hooks buffer child_process cluster console constants crypto
    dgram diagnostics_channel dns domain events fs http http2 https inspector
    module net os path perf_hooks process punycode querystring readline repl
    sea sqlite stream string_decoder sys test timers tls trace_events tty url
    util v8 vm wasi worker_threads zlib
    """.split()
)

_JS_SPEC_RE = re.compile(
    r"""
      \bfrom\s*['"]([^'"]+)['"]
    | \bimport\s*['"]([^'"]+)['"]
    | \brequire\(\s*['"]([^'"]+)['"]\s*\)
    | \bimport\(\s*['"]([^'"]+)['"]\s*\)
    """,
    re.VERBOSE,
)


def extract_python(source: str) -> set[str]:
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return set()
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            if not node.level and node.module:
                names.add(node.module.split(".")[0])
    stdlib = sys.stdlib_module_names
    return {n for n in names if n not in stdlib}


def js_package(spec: str) -> str | None:
    if not spec or spec.startswith((".", "/")) or spec.startswith("node:"):
        return None
    parts = spec.split("/")
    name = f"{parts[0]}/{parts[1]}" if spec.startswith("@") and len(parts) > 1 and parts[1] else parts[0]
    return None if name in NODE_BUILTINS else name


def extract_js(source: str) -> set[str]:
    names = set()
    for match in _JS_SPEC_RE.finditer(source):
        name = js_package(next(g for g in match.groups() if g is not None))
        if name:
            names.add(name)
    return names


def load_cache() -> dict:
    if os.environ.get("ATTESTER_IMPORT_CHECK_NO_CACHE"):
        return {}
    try:
        return json.loads(CACHE_PATH.read_text())
    except (OSError, ValueError):
        return {}


def save_cache(cache: dict) -> None:
    if os.environ.get("ATTESTER_IMPORT_CHECK_NO_CACHE"):
        return
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(cache))
    except OSError:
        pass


def oracle(package: str, ecosystem: str, cache: dict):
    key = f"{ecosystem}:{package}"
    entry = cache.get(key)
    now = time.time()
    if entry is not None:
        ttl = TTL_POSITIVE_S if entry.get("exists") else TTL_NEGATIVE_S
        if now - entry.get("ts", 0) < ttl:
            return entry.get("exists"), entry.get("adjacent_to") or []
    body = json.dumps({"ecosystem": ecosystem, "name": package}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/demo/v1/package/exists",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            info = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            return "quota", []
        return None, []
    except Exception:
        return None, []
    if "exists" not in info:
        return None, []
    cache[key] = {
        "exists": bool(info["exists"]),
        "adjacent_to": info.get("adjacent_to") or [],
        "ts": now,
    }
    save_cache(cache)
    return bool(info["exists"]), info.get("adjacent_to") or []


def load_allowlist() -> set[str]:
    path = Path.cwd() / ".attester-allowlist"
    if not path.is_file():
        return set()
    return {
        line.strip()
        for line in path.read_text(errors="replace").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def new_code(payload: dict) -> str:
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}
    if tool == "Write":
        return tool_input.get("content") or ""
    if tool == "Edit":
        return tool_input.get("new_string") or ""
    if tool == "MultiEdit":
        return "\n".join(
            (edit.get("new_string") or "")
            for edit in (tool_input.get("edits") or [])
        )
    return ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        return 0
    if payload.get("tool_name", "") not in HOOK_TOOLS:
        return 0
    file_path = (payload.get("tool_input") or {}).get("file_path", "")
    ext = Path(file_path).suffix.lower()
    if ext not in PY_EXTS | JS_EXTS:
        return 0
    code = new_code(payload)
    if not code.strip():
        return 0

    ecosystem = "pypi" if ext in PY_EXTS else "npm"
    names = extract_python(code) if ext in PY_EXTS else extract_js(code)
    candidates = sorted(set(names) - load_allowlist())
    if not candidates:
        return 0

    cache = load_cache()
    findings: list[tuple[str, list[str]]] = []
    try:
        for package in candidates:
            answer, adjacent = oracle(package, ecosystem, cache)
            if answer == "quota":
                print(
                    "attester-import-check: attester quota exhausted, unchecked",
                    file=sys.stderr,
                )
                return 0
            if answer is False:
                findings.append((package, adjacent))
    except Exception:
        return 0

    if not findings:
        return 0
    registry = "PyPI" if ecosystem == "pypi" else "npm"
    for package, adjacent in findings:
        msg = f"attester-import-check: '{package}' does not exist on {registry} (attester.dev oracle)."
        if adjacent:
            msg += f" Closest real name: {', '.join(adjacent)}."
        msg += " Remove or fix the import, or add the name to .attester-allowlist if this is a false positive."
        print(msg, file=sys.stderr)
    if os.environ.get("ATTESTER_IMPORT_CHECK_WARN_ONLY"):
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
