"""Bridge CLI: compact JSON reports, or raw unified text from show-diff."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from . import bridge
from .codexcli import CodexCliError
from .contracts import ContractError
from .gitops import BridgeError
from .revision import RevisionError


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bounded Claude-led Codex CLI worker bridge")
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
    run.add_argument("--model", default=None, help="Codex model for this run, e.g. gpt-6.1-sol (task stays unchanged)")
    run.add_argument("--effort", default=None, help="Reasoning effort: low, medium, high, xhigh or max")
    run.add_argument("--handoff", type=Path, default=None, help="Seed the worktree from a verified handoff package")
    cont = sub.add_parser("continue", help="Grant more work to a valid extension request in the same session")
    cont.add_argument("--task", type=Path, required=True)
    cont.add_argument("--artifact", type=Path, required=True)
    cont.add_argument("--grant-turns", type=int, required=True)
    revise = sub.add_parser("revise", help="Send review findings to the same session and worktree")
    revise.add_argument("--task", type=Path, required=True)
    revise.add_argument("--artifact", type=Path, required=True)
    findings = revise.add_mutually_exclusive_group(required=True)
    findings.add_argument("--feedback", type=Path)
    findings.add_argument("--finding", action="append", help="Repeatable path::issue::expected finding")
    revise.add_argument("--grant-turns", type=int, default=4)
    reval = sub.add_parser("revalidate", help="Re-run the task's validation command on the preserved worktree")
    reval.add_argument("--task", type=Path, required=True)
    reval.add_argument("--artifact", type=Path, required=True)
    reval.add_argument("--timeout", type=int, default=None, help="Validation timeout in seconds (1-1800)")
    export = sub.add_parser("export-handoff", help="Package preserved changes for the Grok fallback")
    export.add_argument("--task", type=Path, required=True)
    export.add_argument("--artifact", type=Path, required=True)
    export.add_argument("--output", type=Path, required=True)
    active = sub.add_parser("active", help="Inspect a task's active-run lock")
    active.add_argument("--task-id", required=True)
    clear = sub.add_parser("clear-stale-lock", help="Archive a lock only when its owner process is gone")
    clear.add_argument("--task-id", required=True)
    diff = sub.add_parser("show-diff", help="Print raw unified diff, optionally for selected files or the last round")
    diff.add_argument("--artifact", type=Path, required=True)
    diff.add_argument("--task", type=Path, help="Task for resolving --artifact latest")
    diff.add_argument("--files", help="Comma-separated repository-relative paths")
    diff.add_argument("--since-last", action="store_true")
    accept = sub.add_parser("accept", help="Apply a validated patch and remove its worktree and branch; never commit")
    accept.add_argument("--task", type=Path, required=True)
    accept.add_argument("--artifact", type=Path, required=True)
    integration = accept.add_mutually_exclusive_group()
    integration.add_argument("--3way", dest="three_way", action="store_true")
    integration.add_argument("--already-applied", action="store_true",
                             help="Verify the primary checkout already contains the patch and record acceptance")
    cleanup = sub.add_parser("cleanup", help="Remove rejected worktree and branch, keeping the artifact record")
    cleanup.add_argument("--task", type=Path, required=True)
    cleanup.add_argument("--artifact", type=Path, required=True)
    for command in sub.choices.values():
        command.add_argument("--pretty", action="store_true", default=argparse.SUPPRESS)
        command.add_argument("--full", action="store_true", default=argparse.SUPPRESS)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "preflight":
            result = {"status": "ready", "preflight": bridge.preflight()}
        elif args.command == "usage":
            result = {"status": "ok", "usage": bridge.usage(args.refresh)}
        elif args.command == "check-task":
            result = bridge.check_task(args.task)
        elif args.command == "run":
            result = bridge.run(args.task, model=args.model, effort=args.effort, handoff=args.handoff)
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
            print(bridge.show_diff(artifact, args.files.split(",") if args.files else None, args.since_last), end="")
            return 0
        elif args.command == "accept":
            result = bridge.accept(args.task, args.artifact, args.three_way, args.already_applied)
        elif args.command == "cleanup":
            result = bridge.cleanup(args.task, args.artifact)
        elif args.command == "revalidate":
            result = bridge.revalidate(args.task, args.artifact, args.timeout)
        elif args.command == "export-handoff":
            result = bridge.export_handoff(args.task, args.artifact, args.output)
        elif args.command == "active":
            result = bridge.active(args.task_id)
        else:
            result = bridge.clear_stale_lock(args.task_id)
    except bridge.CapacityPaused as exc:
        print(json.dumps({"status": "capacity_paused", "error": str(exc), "usage": exc.usage},
                         indent=2 if args.pretty else None, separators=None if args.pretty else (",", ":")))
        return 3
    except (BridgeError, CodexCliError, ContractError, RevisionError, OSError, ValueError,
            subprocess.TimeoutExpired) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, indent=2 if args.pretty else None,
                         separators=None if args.pretty else (",", ":")), file=sys.stderr)
        return 2
    shown = result if args.full or args.command not in {"run", "continue", "revise"} else bridge.brief(result)
    print(json.dumps(shown, indent=2 if args.pretty else None, ensure_ascii=False,
                     separators=None if args.pretty else (",", ":")))
    return 0 if result.get("status") not in {"failed", "checkpoint_failed"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
