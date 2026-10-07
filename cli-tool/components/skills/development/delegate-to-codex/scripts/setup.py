"""Check the bundled installation and guide Codex setup without printing account data."""
from __future__ import annotations

import argparse
import json
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


def git_path() -> str | None:
    """Absolute git from PATH only (the bridge's own resolver), or None when git is unavailable."""
    try:
        from claude_codex_bridge.gitops import git_executable
        return git_executable()
    except ImportError:
        # The runtime itself is missing: doctor still reports presence (nothing is run from this result).
        return shutil.which("git")
    except Exception:  # noqa: BLE001 - BridgeError: git not found
        return None


def run(args: list[str], *, cwd: Path = ROOT, env: dict | None = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=60, check=False)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args, 124, "", f"timed out after 60 seconds: {' '.join(map(str, args))}")


def settings_report(add) -> tuple[dict, list[dict]]:
    """The user's settings for ``doctor``: an unreadable file is a failed check, an unset choice a setup item.

    An unset choice never fails the installation: the lead asks the user once, and the first launch refuses
    (status settings_required) until the answer is recorded.
    """
    from claude_codex_bridge import settings as user_settings
    try:
        shown = user_settings.show()
    except (OSError, ValueError, RuntimeError) as exc:
        add("settings_file", False, "Fix or delete the settings file named in the detail, then ask the user their "
            "choices again.", str(exc))
        return {"auto_review": "unreadable"}, []
    items = []
    for key in shown["unset"]:
        items.append({"item": key, "status": "unset", **user_settings.guidance(user_settings.find_setting(key)),
                      "next_action": "Ask the user the question once, then run the matching record_with command."})
    return {**shown["state"], "file": shown["settings_file"]}, items


def doctor(*, offline: bool = False) -> dict:
    checks: list[dict] = []

    def add(name: str, ok: bool, action: str = "", detail: str = ""):
        checks.append({"check": name, "status": "ready" if ok else "setup_required",
                       "detail": detail, "next_action": "" if ok else action})

    add("python", sys.version_info >= (3, 11), "Use Python 3.11 or newer.")
    add("platform", platform.system() == "Windows",
        "This release is verified on native Windows only; other platforms are not claimed ready.")
    add("git", bool(git_path()), "Install Git for Windows: https://git-scm.com/downloads/win")
    try:
        for name in ("task", "reply"):
            json.loads((ROOT / f"schemas/{name}.schema.json").read_text(encoding="utf-8"))
        if not (ROOT / "scripts/codex_bridge.py").is_file():
            raise ValueError("Missing launcher")
        from claude_codex_bridge import bridge  # noqa: F401
        from claude_codex_bridge.state import discover_state_roots, ensure_state_root, state_permission_report
        ensure_state_root()
        add("bundled_runtime", True)
        # Who else can read the transcripts, patches and results kept there. A warning, never a setup failure.
        permissions = state_permission_report()
        directories = discover_state_roots()
    except (ImportError, OSError, ValueError, SyntaxError) as exc:
        add("bundled_runtime", False, "Reinstall the complete skill; use an empty external DELEGATE_TO_CODEX_STATE_DIR "
            "if state ownership conflicts.", str(exc))
        return {"status": "setup_required", "checks": checks, "provider_checks": "not_run"}
    user_choices, setup_items = settings_report(add)
    if offline:
        ready = all(c["status"] == "ready" for c in checks)
        return {"status": "installation_ready" if ready else "setup_required", "checks": checks,
                "provider_checks": "not_run", "state_permissions": permissions, "state_directories": directories,
                "settings": user_choices, "setup_items": setup_items,
                "next_action": "Run doctor without --offline to verify your own Codex sign-in and usage."}
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
            "Wait for the governing window to reset; the detail names when an exhausted window does.", detail)
    except Exception as exc:  # noqa: BLE001 - report every setup failure as guidance
        add("codex_subscription", False,
            f"Install/update the Codex CLI ({CODEX_SETUP}) and run `codex login` with ChatGPT. Unset any API-key "
            "variables named in the detail; never print their values.", str(exc))
    # Ready needs every check: python, platform, git and the bundled runtime as well as the Codex ones.
    status = "codex_ready" if all(c["status"] == "ready" for c in checks) else "setup_required"
    return {"status": status, "checks": checks, "provider_checks": "performed", "account_values_recorded": False,
            "state_permissions": permissions, "state_directories": directories,
            "settings": user_choices, "setup_items": setup_items}


def self_test() -> dict:
    from claude_codex_bridge import bridge
    from claude_codex_bridge.codexcli import CodexCommand
    from claude_codex_bridge.contracts import load_task
    from claude_codex_bridge.state import ensure_state_root
    state = ensure_state_root()
    scratch = state / "scratch"
    scratch.mkdir(exist_ok=True)
    git = git_path()
    if not git:
        raise ValueError("Install Git before running self-test")
    with tempfile.TemporaryDirectory(prefix="fixture-", dir=scratch) as temporary:
        parent = Path(temporary)
        repo = parent / "repository"
        repo.mkdir()
        # Per-command options keep the fixture independent of the user's Git config without copying the environment.
        fixture = [git, "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "commit.gpgSign=false",
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
        task.update(repo_root=str(repo), base_commit=run([git, "rev-parse", "HEAD"], cwd=repo).stdout.strip(),
                    validation_command=[sys.executable, "-m", "unittest", "-v"])
        task_path = parent / "task.json"
        task_path.write_text(json.dumps(task), encoding="utf-8")
        if run([sys.executable, "-B", str(ROOT / "scripts/codex_bridge.py"), "check-task", "--task", str(task_path)]).returncode:
            raise ValueError("Bundled launcher failed the offline task check")
        parsed = load_task(task_path)
        schema = bridge._strict_schema(parent / "schema.json")
        for review in (False, True):
            arguments = bridge._exec_args(CodexCommand(Path(sys.executable)), parsed, repo, schema,
                                          parent / "last.txt", sandbox="workspace-write", effort="medium",
                                          resume=None, auto_review=review)
            if ('approvals_reviewer="auto_review"' in arguments) != review:
                raise ValueError("Codex command construction ignored the auto-review choice")
        if run([sys.executable, "-B", "-m", "unittest", "-v"], cwd=repo).returncode:
            raise ValueError("Independent fixture validation failed")
    return {"status": "passed", "provider_called": False,
            "checks": ["disposable Git fixture", "packaged launcher", "task/reply schemas",
                       "Codex command construction", "independent validation"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    d = sub.add_parser("doctor")
    d.add_argument("--offline", action="store_true")
    sub.add_parser("self-test")
    args = parser.parse_args()
    try:
        record = doctor(offline=args.offline) if args.command == "doctor" else self_test()
    except (ImportError, OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        record = {"status": "setup_required", "detail": str(exc),
                  "next_action": "Follow references/setup.md; do not start Codex work until checks pass."}
    print(json.dumps(record, indent=2))
    return 0 if record["status"] in {"passed", "installation_ready", "codex_ready"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
