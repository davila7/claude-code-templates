"""Bridge CLI: compact JSON reports, or raw unified text from show-diff."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from . import bridge, settings
from .codexcli import CodexCliError
from .contracts import ContractError
from .gitops import BridgeError
from .revision import RevisionError


def _configure_streams() -> None:
    """Emit UTF-8 whatever the console code page is: a piped Windows stdout defaults to cp1252, which cannot
    encode arrows, emoji or CJK text from a worker summary and would crash the command after the work was done."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass


def _json_text(value: object, pretty: bool, *, ensure_ascii: bool = False) -> str:
    return json.dumps(value, indent=2 if pretty else None, ensure_ascii=ensure_ascii,
                      separators=None if pretty else (",", ":"))


def _emit(value: object, pretty: bool, stream=None) -> None:
    """Print one JSON document that is valid whatever the stream can encode (escapes if it cannot take UTF-8)."""
    stream = stream or sys.stdout
    text = _json_text(value, pretty, ensure_ascii=stream is sys.stderr)
    try:
        print(text, file=stream)
    except UnicodeEncodeError:
        print(_json_text(value, pretty, ensure_ascii=True), file=stream)


def _write_patch(data: bytes | str) -> None:
    if isinstance(data, str):
        sys.stdout.write(data)
        return
    buffer = getattr(sys.stdout, "buffer", None)
    if buffer is not None:
        buffer.write(data)
        buffer.flush()
    else:
        sys.stdout.write(data.decode("utf-8", "replace"))


def _error_text(exc: BaseException) -> str:
    return " ".join([str(exc) or type(exc).__name__, *getattr(exc, "__notes__", [])])


ARTIFACT_HELP = ("Artifact directory printed by run, or 'latest' for the newest artifact of --task "
                 "(accept refuses 'latest' unless it is the artifact last reported)")


class _UsageError(Exception):
    """A command line argparse rejected; reported as the documented JSON ``failed`` record, not usage text."""


class _JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message: str):  # type: ignore[override]
        raise _UsageError(f"{self.prog}: {message}")


def _parser() -> argparse.ArgumentParser:
    parser = _JsonArgumentParser(description="Bounded Claude-led Codex CLI worker bridge")
    parser.add_argument("--full", action="store_true",
                        help="Print the complete result record instead of the compact lead summary")
    parser.add_argument("--pretty", action="store_true", help="Indent JSON output")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("preflight", help="Check the Codex CLI, ChatGPT sign-in, billing overrides and current usage")
    usage = sub.add_parser("usage", help="Read Codex plan usage (five-hour window may be absent; weekly then governs)")
    usage.add_argument("--refresh", action="store_true", help="Bypass the 60-second cache")
    check = sub.add_parser("check-task", help="Validate a task without starting Codex")
    check.add_argument("--task", type=Path, required=True)
    run = sub.add_parser("run", help="Run one validated task in a new isolated worktree")
    run.add_argument("--task", type=Path, required=True)
    run.add_argument("--model", default=None, help="Codex model id for this run (overrides the task's model; omit for the Codex default)")
    run.add_argument("--effort", default=None, help="Reasoning effort: low, medium, high, xhigh or max (the Codex CLI decides what a model accepts)")
    cont = sub.add_parser("continue", help="Grant more work to a valid extension request in the same session")
    cont.add_argument("--task", type=Path, required=True)
    cont.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    cont.add_argument("--grant-turns", type=int, required=True,
                      help="Work steps to grant: 1 up to what the worker requested")
    revise = sub.add_parser("revise", help="Send review findings to the same session and worktree")
    revise.add_argument("--task", type=Path, required=True)
    revise.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    findings = revise.add_mutually_exclusive_group(required=True)
    findings.add_argument("--feedback", type=Path,
                          help='JSON file: {"findings":[{"path","issue","expected_behavior"}]}')
    findings.add_argument("--finding", action="append", help="Repeatable path::issue::expected finding")
    revise.add_argument("--grant-turns", type=int, default=4, help="Work steps to grant, 1-12 (default 4)")
    reval = sub.add_parser("revalidate", help="Re-run the task's validation command on the preserved worktree")
    reval.add_argument("--task", type=Path, required=True)
    reval.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    reval.add_argument("--timeout", type=int, default=None, help="Validation timeout in seconds (1-1800)")
    reval.add_argument("--accept-repo-config-change", action="store_true",
                       help="Accept changes you made to the primary repository's code-running settings (hooks, "
                            "aliases, filters, core.hooksPath, ...) since the run started; the old and new hashes "
                            "are recorded")
    active = sub.add_parser("active", help="Inspect a task's active-run lock")
    active.add_argument("--task-id", required=True)
    clear = sub.add_parser("clear-stale-lock", help="Archive a lock only when its owner process is gone")
    clear.add_argument("--task-id", required=True)
    diff = sub.add_parser("show-diff", help="Print raw unified diff, optionally for selected files or the last round")
    diff.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    diff.add_argument("--task", type=Path, help="Task file, needed to resolve --artifact latest")
    diff.add_argument("--files", help="Comma-separated repository-relative paths")
    diff.add_argument("--since-last", action="store_true")
    accept = sub.add_parser("accept", help="Apply a validated patch and remove its worktree and branch; never commit")
    accept.add_argument("--task", type=Path, required=True)
    accept.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    integration = accept.add_mutually_exclusive_group()
    integration.add_argument("--3way", dest="three_way", action="store_true")
    integration.add_argument("--already-applied", action="store_true",
                             help="Verify the primary checkout already contains the patch and record acceptance")
    accept.add_argument("--expect-tree", metavar="TREE",
                        help="Refuse unless the artifact's snapshot tree id (printed in the report as "
                             "review_binding.snapshot_tree; 12+ characters) matches")
    accept.add_argument("--expect-patch-sha256", metavar="SHA256",
                        help="Refuse unless sha256 of diff.patch (review_binding.patch_sha256) matches")
    config = sub.add_parser("settings", help="Show or record the user's settings (shared by every task)")
    config.add_argument("action", choices=["show", "set", "unset"], help="show all settings, set one, or unset one")
    config.add_argument("name", nargs="?", help="Setting name, for example auto-review")
    config.add_argument("value", nargs="?", help="on, off, true, false, enabled or disabled (set only)")
    cleanup = sub.add_parser("cleanup", help="Remove rejected worktree and branch, keeping the artifact record")
    cleanup.add_argument("--task", type=Path, required=True)
    cleanup.add_argument("--artifact", type=Path, required=True, help=ARTIFACT_HELP)
    for command in sub.choices.values():
        command.add_argument("--pretty", action="store_true", default=argparse.SUPPRESS, help="Indent JSON output")
        command.add_argument("--full", action="store_true", default=argparse.SUPPRESS,
                             help="Print the whole result record (only run, continue and revise shorten it)")
    return parser


def main(argv: list[str] | None = None) -> int:
    _configure_streams()
    try:
        args = _parser().parse_args(argv)
    except _UsageError as exc:
        _emit({"status": "failed", "error": f"invalid arguments: {exc}"},
              "--pretty" in (sys.argv[1:] if argv is None else argv), sys.stderr)
        return 2
    try:
        if args.command == "preflight":
            result = {"status": "ready", "preflight": bridge.preflight()}
        elif args.command == "usage":
            result = {"status": "ok", "usage": bridge.usage(args.refresh)}
        elif args.command == "check-task":
            result = bridge.check_task(args.task)
        elif args.command == "run":
            result = bridge.run(args.task, model=args.model, effort=args.effort)
        elif args.command == "continue":
            result = bridge.continue_task(args.task, args.artifact, args.grant_turns)
        elif args.command == "revise":
            feedback = args.feedback
            if args.finding:
                entries = []
                for finding in args.finding:
                    parts = finding.split("::", 2)
                    if len(parts) != 3:
                        raise RevisionError("--finding must be path::issue::expected")
                    entries.append(dict(zip(("path", "issue", "expected_behavior"), parts)))
                feedback = {"findings": entries}
            result = bridge.revise_task(args.task, args.artifact, feedback, args.grant_turns)
        elif args.command == "show-diff":
            artifact = bridge.resolve_artifact(args.artifact, args.task)
            files = [item.strip() for item in args.files.split(",") if item.strip()] if args.files else None
            _write_patch(bridge.show_diff(artifact, files or None, args.since_last, raw=True))
            return 0
        elif args.command == "accept":
            result = bridge.accept(args.task, args.artifact, args.three_way, args.already_applied,
                                   expect_tree=args.expect_tree, expect_patch_sha256=args.expect_patch_sha256)
        elif args.command == "cleanup":
            result = bridge.cleanup(args.task, args.artifact)
        elif args.command == "revalidate":
            result = bridge.revalidate(args.task, args.artifact, args.timeout,
                                       accept_repo_config_change=args.accept_repo_config_change)
        elif args.command == "settings":
            result = settings.run_command(args.action, args.name, args.value)
        elif args.command == "active":
            result = bridge.active(args.task_id)
        else:
            result = bridge.clear_stale_lock(args.task_id)
    except bridge.CapacityPaused as exc:
        _emit({"status": "capacity_paused", "error": str(exc), "usage": exc.usage}, args.pretty)
        return 3
    except settings.SettingsRequired as exc:
        _emit(exc.result(), args.pretty)
        return 4
    except (BridgeError, CodexCliError, ContractError, RevisionError, OSError, ValueError,
            subprocess.TimeoutExpired) as exc:
        _emit({"status": "failed", "error": _error_text(exc)}, args.pretty, sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001 - anything else is still reported as JSON, never as a traceback
        # A record or file that is not shaped as expected (hand-edited or damaged) or an internal error: the
        # run's own record (and any worktree) is kept by the bridge, and its path travels in the exception notes.
        _emit({"status": "failed", "error": f"unexpected error: {type(exc).__name__}: {_error_text(exc)}"},
              args.pretty, sys.stderr)
        return 2
    shown = result if args.full or args.command not in {"run", "continue", "revise"} else bridge.brief(result)
    _emit(shown, args.pretty)
    return 0 if result.get("status") not in {"failed", "checkpoint_failed"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
