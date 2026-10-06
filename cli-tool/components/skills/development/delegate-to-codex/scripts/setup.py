"""Check the bundled installation and guide Codex/Grok setup without printing account data."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
CODEX_SETUP = "https://developers.openai.com/codex/cli"
GROK_SETUP = "https://docs.x.ai/build/overview"


def run(args: list[str], *, cwd: Path = ROOT, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=60, check=False)


def grok_module():
    spec = importlib.util.spec_from_file_location("delegate_to_codex_grok", ROOT / "scripts/grok_bridge.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def doctor(*, offline: bool = False, require_grok: bool = False) -> dict:
    checks: list[dict] = []

    def add(name: str, ok: bool, action: str = "", detail: str = ""):
        checks.append({"check": name, "status": "ready" if ok else "setup_required",
                       "detail": detail, "next_action": "" if ok else action})

    add("python", sys.version_info >= (3, 11), "Use Python 3.11 or newer.")
    add("platform", platform.system() == "Windows",
        "This release is verified on native Windows only; other platforms are not claimed ready.")
    add("git", bool(shutil.which("git")), "Install Git for Windows: https://git-scm.com/downloads/win")
    try:
        for name in ("task", "reply", "checkpoint"):
            json.loads((ROOT / f"schemas/{name}.schema.json").read_text(encoding="utf-8"))
        for name in ("codex_bridge.py", "grok_bridge.py"):
            if not (ROOT / "scripts" / name).is_file():
                raise ValueError("Missing launcher")
        from claude_codex_bridge import bridge  # noqa: F401
        from claude_codex_bridge.state import ensure_state_root
        grok_module()
        ensure_state_root()
        add("bundled_runtime", True)
    except (ImportError, OSError, ValueError) as exc:
        add("bundled_runtime", False, "Reinstall the complete skill; use an empty external DELEGATE_TO_CODEX_STATE_DIR "
            "if state ownership conflicts.", str(exc))
        return {"status": "setup_required", "checks": checks, "provider_checks": "not_run"}
    if offline:
        ready = all(c["status"] == "ready" for c in checks)
        return {"status": "installation_ready" if ready else "setup_required", "checks": checks,
                "provider_checks": "not_run",
                "next_action": "Run doctor without --offline to verify your own Codex sign-in and usage."}
    from claude_codex_bridge import bridge
    try:
        record = bridge.preflight()
        add("codex_subscription", True, detail=f"{record['version']}; plan {record.get('plan_type')}")
        usage = record["usage"]
        five = usage.get("five_hour", {})
        detail = (f"gate {usage['gate']}; five-hour "
                  + (f"{five.get('remaining_percent')}% left" if five.get("applicable") else "not reported (trusted)")
                  + "; weekly "
                  + (f"{usage['weekly'].get('remaining_percent')}% left" if usage.get("weekly", {}).get("applicable") else "not reported"))
        add("codex_capacity", usage["gate"] == "available",
            "Wait for the governing window to reset, or use the verified Grok fallback if it is exhausted.", detail)
    except Exception as exc:  # noqa: BLE001 - report every setup failure as guidance
        add("codex_subscription", False,
            f"Install/update the Codex CLI ({CODEX_SETUP}) and run `codex login` with ChatGPT. Unset any API-key "
            "variables named in the detail; never print their values.", str(exc))
    try:
        grok = grok_module()
        record = grok._preflight()
        add("grok_subscription", True, detail=record["version"])
    except Exception as exc:  # noqa: BLE001
        add("grok_subscription", False,
            f"Optional fallback: install native Grok Build ({GROK_SETUP}) and run `grok login`; never use an API key.", str(exc))
    codex_ok = all(c["status"] == "ready" for c in checks if c["check"].startswith("codex"))
    grok_ok = all(c["status"] == "ready" for c in checks if c["check"].startswith("grok"))
    status = ("codex_and_grok_ready" if codex_ok and grok_ok else
              "codex_ready" if codex_ok and not require_grok else "setup_required")
    return {"status": status, "checks": checks, "provider_checks": "performed", "fallback_ready": grok_ok,
            "account_values_recorded": False}


def self_test() -> dict:
    from claude_codex_bridge import bridge
    from claude_codex_bridge.codexcli import CodexCommand
    from claude_codex_bridge.contracts import load_task
    from claude_codex_bridge.state import ensure_state_root
    state = ensure_state_root()
    scratch = state / "scratch"
    scratch.mkdir(exist_ok=True)
    if not shutil.which("git"):
        raise ValueError("Install Git before running self-test")
    with tempfile.TemporaryDirectory(prefix="fixture-", dir=scratch) as temporary:
        parent = Path(temporary)
        repo = parent / "repository"
        repo.mkdir()
        # Per-command options keep the fixture independent of the user's Git config without copying the environment.
        fixture = ["git", "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "commit.gpgSign=false",
                   "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid"]
        if run([*fixture, "init", "-q"], cwd=repo).returncode:
            raise ValueError("Git fixture initialization failed")
        (repo / "README.md").write_text("Return a friendly greeting.\n", encoding="utf-8")
        (repo / "greeting.py").write_text("def greet():\n    return 'Hello'\n", encoding="utf-8")
        (repo / "test_greeting.py").write_text(
            "import unittest\nfrom greeting import greet\nclass TestGreeting(unittest.TestCase):\n"
            "    def test_greet(self):\n        self.assertEqual(greet(), 'Hello')\n", encoding="utf-8")
        for args in ([*fixture, "add", "."], [*fixture, "commit", "-qm", "Synthetic fixture"]):
            if run(args, cwd=repo).returncode:
                raise ValueError("Git fixture commit failed")
        task = json.loads((ROOT / "assets/task.template.json").read_text(encoding="utf-8"))
        task.update(repo_root=str(repo), base_commit=run(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip(),
                    validation_command=[sys.executable, "-m", "unittest", "-v"])
        task_path = parent / "task.json"
        task_path.write_text(json.dumps(task), encoding="utf-8")
        for name in ("codex_bridge.py", "grok_bridge.py"):
            if run([sys.executable, "-B", str(ROOT / "scripts" / name), "check-task", "--task", str(task_path)]).returncode:
                raise ValueError(f"Bundled {name} failed the offline task check")
        parsed = load_task(task_path)
        schema = bridge._strict_schema(parent / "schema.json")
        bridge._exec_args(CodexCommand(Path(sys.executable)), parsed, repo, schema, parent / "last.txt",
                          sandbox="workspace-write", effort="medium", resume=None)
        grok = grok_module()
        grok._args(parsed, repo, parent / "prompt.txt", 2, grok.REPLY_SCHEMA)
        if run([sys.executable, "-B", "-m", "unittest", "-v"], cwd=repo).returncode:
            raise ValueError("Independent fixture validation failed")
    return {"status": "passed", "provider_called": False,
            "checks": ["disposable Git fixture", "both packaged launchers", "task/reply/checkpoint schemas",
                       "Codex and Grok command construction", "independent validation"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    d = sub.add_parser("doctor")
    d.add_argument("--offline", action="store_true")
    d.add_argument("--require-grok", action="store_true")
    sub.add_parser("self-test")
    args = parser.parse_args()
    try:
        record = doctor(offline=args.offline, require_grok=args.require_grok) if args.command == "doctor" else self_test()
    except (ImportError, OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        record = {"status": "setup_required", "detail": str(exc),
                  "next_action": "Follow references/setup.md; do not start Codex work until checks pass."}
    print(json.dumps(record, indent=2))
    return 0 if record["status"] in {"passed", "installation_ready", "codex_ready", "codex_and_grok_ready"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
